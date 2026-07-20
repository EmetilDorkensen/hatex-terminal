-- ============================================================================
-- Mesaj inik: "Fon ensifizan" (pa ekspoze balans / chemen teknik)
-- Si 20260761 deja kouri ak mesaj long, re-aplike RPC peman yo.
-- ============================================================================

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
  v_api_fee NUMERIC;
  v_merchant_net NUMERIC;
  v_fee_rate NUMERIC;
  v_kes NUMERIC;
  v_freeze_msg TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;
  IF p_client_id = p_merchant_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa ka peye tèt ou.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id IN (p_client_id, p_merchant_id) FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'hatex_reject_if_card_frozen'
  ) THEN
    v_freeze_msg := public.hatex_reject_if_card_frozen(p_client_id);
    IF v_freeze_msg IS NOT NULL THEN
      RETURN json_build_object('success', false, 'message', v_freeze_msg, 'card_frozen', true);
    END IF;
  END IF;

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
    RETURN json_build_object('success', false, 'message', 'Fon ensifizan');
  END IF;

  SELECT wallet_balance, account_type
  INTO v_merchant_balance, v_merchant_account_type
  FROM public.profiles WHERE id = p_merchant_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Machann pa jwenn.');
  END IF;

  v_fee_rate := public.hatex_resolve_fee('api_fee_per_1000', p_merchant_id, 3);
  v_api_fee := ROUND((p_amount / 1000.0) * v_fee_rate, 2);
  v_merchant_net := ROUND(p_amount - v_api_fee, 2);

  v_daily_cap := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 50000 END;
  IF (COALESCE(p_daily_received_so_far, 0) + p_amount) > v_daily_cap THEN
    RETURN json_build_object('success', false, 'message', 'Machann nan rive nan limit resepsyon jounalye a.');
  END IF;

  v_max_balance := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_merchant_balance, 0) + v_merchant_net) > v_max_balance THEN
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
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_merchant_net
  WHERE id = p_merchant_id;

  v_transaction_ref := 'HTX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
  VALUES (
    p_client_id, -p_amount, 'PURCHASE',
    'Peman sou entènèt: ' || COALESCE(p_merchant_name, 'Machann')
      || ' (Kòmand #' || COALESCE(NULLIF(p_order_id, ''), 'N/A') || ')',
    'success', v_transaction_ref || '-C',
    jsonb_build_object('source', 'public_api', 'debit_from', v_debit_source, 'tx_ref', v_transaction_ref, 'api_fee', v_api_fee)
  )
  RETURNING id INTO v_client_tx_id;

  INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
  VALUES (
    p_merchant_id, v_merchant_net, 'SALE',
    'Lavant sou entènèt (net) — frè API: ' || v_api_fee || ' HTG',
    'success', v_transaction_ref || '-M',
    jsonb_build_object('source', 'public_api', 'gross_amount', p_amount, 'api_fee', v_api_fee, 'net_amount', v_merchant_net)
  )
  RETURNING id INTO v_merchant_tx_id;

  IF v_api_fee > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
    VALUES (
      p_merchant_id, -v_api_fee, 'API_FEE',
      'Frè API (' || v_fee_rate || ' HTG / 1 000)',
      'success', v_transaction_ref || '-F',
      jsonb_build_object('source', 'public_api', 'gross_amount', p_amount, 'fee_rate_per_1000', v_fee_rate)
    );
    BEGIN
      v_kes := public.hatex_credit_kes_global(v_api_fee, 'api_receive_fee');
    EXCEPTION WHEN OTHERS THEN
      v_kes := NULL;
    END;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Peman an fèt ak siksè!',
    'transaction_id', v_client_tx_id,
    'reference', v_transaction_ref,
    'merchant_transaction_id', v_merchant_tx_id,
    'debited_from', v_debit_source,
    'gross_amount', p_amount,
    'api_fee', v_api_fee,
    'net_amount', v_merchant_net,
    'kes_global_balance', v_kes
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) TO service_role;
