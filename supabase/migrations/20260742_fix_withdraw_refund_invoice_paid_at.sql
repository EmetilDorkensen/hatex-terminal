-- ============================================================================
-- FIX: ranbousman retrè (pa double frè) + kolòn paid_at sou invoices
-- Kouri nan Supabase > SQL Editor.
-- ============================================================================

-- 1. Kolòn paid_at (tab invoices ki te egziste anvan migrasyon 20260707)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 2. Ranbousman retrè: sèlman montan BRUT ki te koupe sou wallet la
--    (frè 5% se pou kalkil nèt admin voye — li pa te koupe anplis sou wallet)
CREATE OR REPLACE FUNCTION public.admin_reject_finance_item(
  p_table TEXT,
  p_item_id UUID,
  p_reason TEXT DEFAULT 'Rejte pa admin'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_row RECORD;
  v_refund NUMERIC;
  v_new_bal NUMERIC;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND v_email <> 'adminhatexcard@gmail.com'
     AND NOT EXISTS (SELECT 1 FROM public.staff_users WHERE email = v_email AND status = 'active') THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  IF p_table = 'deposits' THEN
    SELECT * INTO v_row FROM public.deposits WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Pa jwenn.'); END IF;
    IF v_row.status IS DISTINCT FROM 'pending' THEN
      RETURN json_build_object('success', false, 'message', 'Deja trete.');
    END IF;
    UPDATE public.deposits SET status = 'rejected' WHERE id = p_item_id;
    INSERT INTO public.transactions (user_id, amount, type, description, status)
    VALUES (v_row.user_id, 0, 'REJECTED', 'Anile depo: ' || COALESCE(p_reason, ''), 'failed');
    RETURN json_build_object('success', true);

  ELSIF p_table = 'withdrawals' THEN
    SELECT * INTO v_row FROM public.withdrawals WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Pa jwenn.'); END IF;
    IF v_row.status IS DISTINCT FROM 'pending' THEN
      RETURN json_build_object('success', false, 'message', 'Deja trete.');
    END IF;

    -- process_wallet_withdrawal debite SEULEMENT v_row.amount (montan brit)
    v_refund := COALESCE(v_row.amount, 0);

    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_refund
    WHERE id = v_row.user_id
    RETURNING wallet_balance INTO v_new_bal;

    IF v_new_bal IS NULL THEN
      RETURN json_build_object('success', false, 'message', 'Pa t kapab ranbouse wallet.');
    END IF;

    UPDATE public.withdrawals SET status = 'rejected' WHERE id = p_item_id;

    INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
    VALUES (
      v_row.user_id,
      v_refund,
      'REFUND',
      'Ranbousman retrè anile (+' || v_refund || ' HTG): ' || COALESCE(p_reason, ''),
      'success',
      jsonb_build_object(
        'withdrawal_id', p_item_id,
        'gross_amount', v_row.amount,
        'fee_not_refunded', COALESCE(v_row.fee, 0),
        'reason', 'Frè retrè pa te koupe anplis sou wallet; sèlman montan brit la te debite.'
      )
    );

    RETURN json_build_object(
      'success', true,
      'refunded', v_refund,
      'wallet_balance', v_new_bal,
      'fee_was', COALESCE(v_row.fee, 0)
    );

  ELSE
    RETURN json_build_object('success', false, 'message', 'Tab pa valab.');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reject_finance_item(TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reject_finance_item(TEXT, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_finance_item(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_finance_item(TEXT, UUID, TEXT) TO service_role;

-- 3. Peman fakti — mete paid_at apre kolòn an egziste
CREATE OR REPLACE FUNCTION public.process_invoice_card_payment(
  p_invoice_id UUID,
  p_client_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_client_status TEXT;
  v_client_card NUMERIC;
  v_merchant_bal NUMERIC;
  v_merchant_type TEXT;
  v_max_bal NUMERIC;
  v_ref TEXT;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Fakti pa jwenn.');
  END IF;
  IF v_inv.status = 'paid' THEN
    RETURN json_build_object('success', false, 'message', 'Fakti sa a te deja peye.');
  END IF;
  IF v_inv.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Fakti sa a pa disponib pou peman.');
  END IF;
  IF p_client_id = v_inv.owner_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa ka peye pwòp fakti ou.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id IN (p_client_id, v_inv.owner_id) FOR UPDATE;

  SELECT account_status, COALESCE(card_balance, 0)
    INTO v_client_status, v_client_card
  FROM public.profiles WHERE id = p_client_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kat kliyan an pa rekonèt.');
  END IF;
  IF v_client_status IS DISTINCT FROM 'active' THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan an pa aktif.');
  END IF;
  IF v_client_card < v_inv.amount THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase fon sou kat ou a.');
  END IF;

  SELECT COALESCE(wallet_balance, 0), account_type
    INTO v_merchant_bal, v_merchant_type
  FROM public.profiles WHERE id = v_inv.owner_id;

  v_max_bal := CASE WHEN v_merchant_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (v_merchant_bal + v_inv.amount) > v_max_bal THEN
    RETURN json_build_object('success', false, 'message', 'Balans machann nan ta depase limit maksimòm.');
  END IF;

  v_ref := 'INV-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 9));

  UPDATE public.profiles SET card_balance = card_balance - v_inv.amount WHERE id = p_client_id;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + v_inv.amount WHERE id = v_inv.owner_id;

  UPDATE public.invoices
  SET status = 'paid', paid_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id, metadata)
  VALUES (
    v_inv.owner_id, v_inv.amount, 'SALE', 'success',
    'Peman Fakti: ' || COALESCE(v_inv.description, 'Invoice') || ' (' || v_inv.client_email || ')',
    v_ref || '-M',
    jsonb_build_object('source', 'invoice', 'invoice_id', p_invoice_id, 'wallet_synced', true)
  );

  INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id, metadata)
  VALUES (
    p_client_id, -v_inv.amount, 'PAYMENT', 'success',
    'Peman Fakti Hatex',
    v_ref || '-C',
    jsonb_build_object('source', 'invoice', 'invoice_id', p_invoice_id)
  );

  RETURN json_build_object('success', true, 'message', 'Peman an reyisi!', 'reference', v_ref);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_invoice_card_payment(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_invoice_card_payment(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_invoice_card_payment(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_invoice_card_payment(UUID, UUID) TO service_role;
