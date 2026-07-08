-- ============================================================================
-- FIX: depo / anile retrè / peman fakti / PIN pou tout itilizatè
-- Kouri NAN Supabase > SQL Editor apre deploy kòd la.
-- ============================================================================

-- 1. RPC finansye: otorize service_role (API sèvè verifye admin/staff anvan)
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(
  p_deposit_id UUID,
  p_final_amount NUMERIC DEFAULT NULL,
  p_fee NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep RECORD;
  v_amount NUMERIC;
  v_fee NUMERIC;
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_is_admin BOOLEAN;
  v_is_staff BOOLEAN;
  v_bal NUMERIC;
  v_type TEXT;
  v_max NUMERIC;
  v_new_bal NUMERIC;
BEGIN
  v_is_admin := v_email = 'adminhatexcard@gmail.com';
  v_is_staff := EXISTS (
    SELECT 1 FROM public.staff_users WHERE email = v_email AND status = 'active'
  );
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT (v_is_admin OR v_is_staff) THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Depo pa jwenn.');
  END IF;
  IF v_dep.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Depo sa a deja trete.', 'status', v_dep.status);
  END IF;

  v_amount := COALESCE(p_final_amount, v_dep.amount);
  v_fee := COALESCE(p_fee, v_dep.fee, 0);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  SELECT wallet_balance, account_type INTO v_bal, v_type
  FROM public.profiles WHERE id = v_dep.user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Pwofil kliyan pa jwenn.');
  END IF;

  v_max := CASE WHEN v_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_bal, 0) + v_amount) > v_max THEN
    RETURN json_build_object('success', false, 'message', 'Balans ta depase limit maksimòm.');
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount
  WHERE id = v_dep.user_id
  RETURNING wallet_balance INTO v_new_bal;

  IF v_new_bal IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Pa t kapab kredite wallet.');
  END IF;

  UPDATE public.deposits
  SET status = 'approved',
      amount = v_amount,
      fee = v_fee,
      total_to_pay = COALESCE(v_dep.total_to_pay, v_amount + v_fee)
  WHERE id = p_deposit_id;

  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (v_dep.user_id, v_amount, 'DEPOSIT', 'Depo konfime: +' || v_amount || ' HTG', 'success');

  RETURN json_build_object(
    'success', true,
    'message', 'Depo apwouve.',
    'amount', v_amount,
    'wallet_balance', v_new_bal
  );
END;
$$;

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
    -- process_wallet_withdrawal debite SEULEMENT amount (montan brit) — pa amount + fee
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
      jsonb_build_object('withdrawal_id', p_item_id, 'gross_amount', v_row.amount, 'fee_was', COALESCE(v_row.fee, 0))
    );
    RETURN json_build_object('success', true, 'refunded', v_refund, 'wallet_balance', v_new_bal);

  ELSE
    RETURN json_build_object('success', false, 'message', 'Tab pa valab.');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_complete_withdrawal(p_withdrawal_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_row RECORD;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND v_email <> 'adminhatexcard@gmail.com'
     AND NOT EXISTS (SELECT 1 FROM public.staff_users WHERE email = v_email AND status = 'active') THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  SELECT * INTO v_row FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Pa jwenn.'); END IF;
  IF v_row.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Deja trete.');
  END IF;

  UPDATE public.withdrawals SET status = 'completed' WHERE id = p_withdrawal_id;
  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (v_row.user_id, -COALESCE(v_row.amount, 0), 'WITHDRAWAL',
          'Retrè konfime: -' || v_row.amount || ' HTG', 'success');
  RETURN json_build_object('success', true);
END;
$$;

-- Dwa egzekisyon
REVOKE EXECUTE ON FUNCTION public.admin_approve_deposit(UUID, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_approve_deposit(UUID, NUMERIC, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID, NUMERIC, NUMERIC) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_reject_finance_item(TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reject_finance_item(TEXT, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_finance_item(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_finance_item(TEXT, UUID, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_complete_withdrawal(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_complete_withdrawal(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_complete_withdrawal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_withdrawal(UUID) TO service_role;

-- 2. Peman fakti: service_role dwe kapab egzekite (API sèvè)
REVOKE EXECUTE ON FUNCTION public.process_invoice_card_payment(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_invoice_card_payment(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_invoice_card_payment(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_invoice_card_payment(UUID, UUID) TO service_role;

-- 3. QR payment: retounen UUID tranzaksyon (pa sèlman HTX-ref)
CREATE OR REPLACE FUNCTION public.process_direct_card_payment(
  p_client_id UUID,
  p_merchant_id UUID,
  p_amount NUMERIC,
  p_order_id TEXT DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_merchant_name TEXT DEFAULT NULL,
  p_daily_received_so_far NUMERIC DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_card_balance NUMERIC;
  v_client_wallet_balance NUMERIC;
  v_client_status TEXT;
  v_merchant_balance NUMERIC;
  v_merchant_account_type TEXT;
  v_debit_source TEXT;
  v_max_balance NUMERIC;
  v_transaction_ref TEXT;
  v_client_tx_id UUID;
  v_merchant_tx_id UUID;
  v_daily_cap NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  IF p_client_id = p_merchant_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa ka peye tèt ou.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id IN (p_client_id, p_merchant_id) FOR UPDATE;

  SELECT card_balance, wallet_balance, account_status
  INTO v_client_card_balance, v_client_wallet_balance, v_client_status
  FROM public.profiles WHERE id = p_client_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kat kliyan an pa rekonèt.');
  END IF;
  IF v_client_status IS DISTINCT FROM 'active' THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan an pa aktif.');
  END IF;

  IF COALESCE(v_client_card_balance, 0) >= p_amount THEN
    v_debit_source := 'card';
  ELSIF COALESCE(v_client_wallet_balance, 0) >= p_amount THEN
    v_debit_source := 'wallet';
  ELSE
    RETURN json_build_object(
      'success', false,
      'message',
      'Ou pa gen ase fon. Kat: ' || COALESCE(v_client_card_balance, 0)
        || ' HTG, Wallet: ' || COALESCE(v_client_wallet_balance, 0) || ' HTG.'
    );
  END IF;

  SELECT wallet_balance, account_type
  INTO v_merchant_balance, v_merchant_account_type
  FROM public.profiles WHERE id = p_merchant_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Machann pa jwenn.');
  END IF;

  v_daily_cap := CASE WHEN v_merchant_account_type = 'business' THEN 500000 ELSE 50000 END;
  IF (COALESCE(p_daily_received_so_far, 0) + p_amount) > v_daily_cap THEN
    RETURN json_build_object('success', false, 'message', 'Machann nan rive nan limit resepsyon jounalye a.');
  END IF;

  v_max_balance := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_merchant_balance, 0) + p_amount) > v_max_balance THEN
    RETURN json_build_object(
      'success', false,
      'message',
      'Balans machann nan ta depase limit maksimòm otorize a (' || v_max_balance || ' HTG).'
    );
  END IF;

  IF v_debit_source = 'card' THEN
    UPDATE public.profiles SET card_balance = card_balance - p_amount WHERE id = p_client_id;
  ELSE
    UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_client_id;
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
  WHERE id = p_merchant_id;

  v_transaction_ref := 'HTX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
  VALUES (
    p_client_id, -p_amount, 'PURCHASE',
    'Peman sou entènèt: ' || COALESCE(p_merchant_name, 'Machann')
      || ' (Kòmand #' || COALESCE(NULLIF(p_order_id, ''), 'N/A') || ')',
    'success',
    v_transaction_ref || '-C',
    jsonb_build_object(
      'source', 'public_api',
      'debit_from', v_debit_source,
      'tx_ref', v_transaction_ref,
      'order_id', p_order_id,
      'customer_name', p_client_name
    )
  )
  RETURNING id INTO v_client_tx_id;

  INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
  VALUES (
    p_merchant_id, p_amount, 'SALE',
    'Lavant sou entènèt: Kliyan ' || COALESCE(p_client_name, 'Kliyan')
      || ' (Kòmand #' || COALESCE(NULLIF(p_order_id, ''), 'N/A') || ')',
    'success',
    v_transaction_ref || '-M',
    jsonb_build_object(
      'source', 'public_api',
      'debit_from', v_debit_source,
      'tx_ref', v_transaction_ref,
      'wallet_synced', true,
      'order_id', p_order_id,
      'customer_name', p_client_name
    )
  )
  RETURNING id INTO v_merchant_tx_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Peman an fèt ak siksè!',
    'transaction_id', v_client_tx_id,
    'reference', v_transaction_ref,
    'merchant_transaction_id', v_merchant_tx_id,
    'debited_from', v_debit_source
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) TO service_role;
