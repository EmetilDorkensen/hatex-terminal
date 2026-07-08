-- ============================================================================
-- LANSMAN NASYONAL — bouche twou kritik (P0)
-- ============================================================================

-- 1. Revoke process_direct_card_payment depi navigatè (sèlman service_role / API sèvè)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'process_direct_card_payment'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(%s) FROM PUBLIC', r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(%s) FROM anon', r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(%s) FROM authenticated', r.args);
  END LOOP;
END $$;

-- 2. Frè rechaj kat fiks sou sèvè (10 HTG) — ignore fee_input kliyan
CREATE OR REPLACE FUNCTION public.transfer_wallet_to_card(
  user_id_input UUID,
  amount_input NUMERIC,
  fee_input NUMERIC DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet NUMERIC;
  v_fee NUMERIC := 10;
  v_total NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> user_id_input THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;
  IF amount_input IS NULL OR amount_input <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  v_total := amount_input + v_fee;

  SELECT wallet_balance INTO v_wallet
  FROM public.profiles WHERE id = user_id_input FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;
  IF COALESCE(v_wallet, 0) < v_total THEN
    RETURN json_build_object('success', false, 'message', 'Balans wallet pa ase (montan + frè 10 HTG).');
  END IF;

  UPDATE public.profiles SET
    wallet_balance = wallet_balance - v_total,
    card_balance = COALESCE(card_balance, 0) + amount_input
  WHERE id = user_id_input;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (user_id_input, 'CARD_RECHARGE', amount_input, 'success', 'Rechaj kat soti nan wallet');

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (user_id_input, 'FEE', -v_fee, 'success', 'Frè rechaj kat');

  RETURN json_build_object('success', true, 'message', 'Kat ou rechaje ak siksè!');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transfer_wallet_to_card(UUID, NUMERIC, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.transfer_wallet_to_card(UUID, NUMERIC, NUMERIC) TO authenticated;

-- 3. Anpeche machann make fakti 'paid' depi navigatè
CREATE OR REPLACE FUNCTION public.trg_invoices_block_status_tamper()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'paid' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Estati paid sèlman atravè peman verifye.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_block_status_tamper ON public.invoices;
CREATE TRIGGER trg_invoices_block_status_tamper
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoices_block_status_tamper();

-- Retire lekti piblik tout tab invoices
DROP POLICY IF EXISTS "invoices_public_view_by_id" ON public.invoices;

CREATE POLICY "invoices_owner_select" ON public.invoices
  FOR SELECT USING (auth.uid() = owner_id);

-- 4. RPC peman fakti terminal (invoices)
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

  UPDATE public.invoices SET status = 'paid', paid_at = now() WHERE id = p_invoice_id;

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

-- 5. Senkronizasyon revni terminal — kalkil sou sèvè (pa konfye montan kliyan)
CREATE OR REPLACE FUNCTION public.sync_merchant_terminal_earnings(p_merchant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum NUMERIC := 0;
  v_tx RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_merchant_id THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_merchant_id FOR UPDATE;

  FOR v_tx IN
    SELECT id, amount FROM public.transactions
    WHERE user_id = p_merchant_id
      AND type IN ('SALE', 'SALE_SDK')
      AND status = 'success'
      AND COALESCE(metadata->>'wallet_synced', 'false') <> 'true'
      AND COALESCE(metadata->>'source', '') NOT IN ('public_api', 'invoice', 'subscription')
  LOOP
    v_sum := v_sum + COALESCE(v_tx.amount, 0);
    UPDATE public.transactions
    SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"wallet_synced": true}'::jsonb
    WHERE id = v_tx.id;
  END LOOP;

  -- Backfill: tranzaksyon API ki deja kredite wallet — make synced san double-kredi
  UPDATE public.transactions
  SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"wallet_synced": true}'::jsonb
  WHERE user_id = p_merchant_id
    AND type IN ('SALE', 'SALE_SDK', 'MERCHANT_RECEIPT')
    AND COALESCE(metadata->>'wallet_synced', 'false') <> 'true'
    AND COALESCE(metadata->>'source', '') IN ('public_api', 'subscription', 'invoice');

  IF v_sum <= 0 THEN
    RETURN json_build_object('success', true, 'message', 'Pa gen revni nouvo pou senkronize.', 'amount', 0);
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_sum
  WHERE id = p_merchant_id;

  RETURN json_build_object('success', true, 'message', 'Balans Wallet ou moute avèk siksè!', 'amount', v_sum);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_merchant_terminal_earnings(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_merchant_terminal_earnings(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_merchant_terminal_earnings(UUID) TO authenticated;

-- 6. Retire lekti piblik payment_requests (itilize /api/pay/[id]/session)
DROP POLICY IF EXISTS payment_requests_public_read ON public.payment_requests;

CREATE POLICY payment_requests_merchant_select ON public.payment_requests
  FOR SELECT USING (auth.uid() = merchant_id);

-- 7. RLS plugin_transactions (si tab egziste)
-- Kolòn yo: merchant_id, order_id, customer_info (JSON), dispute_details (JSON) — PA gen user_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plugin_transactions') THEN
    EXECUTE 'ALTER TABLE public.plugin_transactions ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS plugin_tx_user_select ON public.plugin_transactions';
    EXECUTE 'DROP POLICY IF EXISTS plugin_tx_user_insert ON public.plugin_transactions';
    EXECUTE 'DROP POLICY IF EXISTS plugin_tx_merchant_select ON public.plugin_transactions';
    EXECUTE 'DROP POLICY IF EXISTS plugin_tx_client_select ON public.plugin_transactions';

    EXECUTE $policy$
      CREATE POLICY plugin_tx_merchant_select ON public.plugin_transactions
        FOR SELECT USING (auth.uid() = merchant_id)
    $policy$;

    EXECUTE $policy$
      CREATE POLICY plugin_tx_client_select ON public.plugin_transactions
        FOR SELECT USING (
          lower(COALESCE(customer_info->>'email', '')) = lower(COALESCE(auth.jwt() ->> 'email', ''))
          OR COALESCE(dispute_details->>'client_id', '') = auth.uid()::text
        )
    $policy$;
  END IF;
END $$;

-- ============================================================================
-- VERIFYE:
-- SELECT grantee, privilege_type FROM information_schema.routine_privileges
-- WHERE routine_name = 'process_direct_card_payment';
-- (sèlman postgres + service_role)
-- ============================================================================
