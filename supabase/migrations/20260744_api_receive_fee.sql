-- Frè API 3% sou chak peman resevwa via /api/public/payments
-- Machann resevwa NET (97%); frè a antre nan Kès Global via tranzaksyon API_FEE.

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

  v_api_fee := ROUND(p_amount * 0.03, 2);
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
    'success',
    v_transaction_ref || '-C',
    jsonb_build_object(
      'source', 'public_api',
      'debit_from', v_debit_source,
      'tx_ref', v_transaction_ref,
      'order_id', p_order_id,
      'customer_name', p_client_name,
      'gross_amount', p_amount,
      'api_fee', v_api_fee
    )
  )
  RETURNING id INTO v_client_tx_id;

  INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
  VALUES (
    p_merchant_id, v_merchant_net, 'SALE',
    'Lavant sou entènèt (net): Kliyan ' || COALESCE(p_client_name, 'Kliyan')
      || ' (Kòmand #' || COALESCE(NULLIF(p_order_id, ''), 'N/A') || ') — frè API 3%: '
      || v_api_fee || ' HTG',
    'success',
    v_transaction_ref || '-M',
    jsonb_build_object(
      'source', 'public_api',
      'debit_from', v_debit_source,
      'tx_ref', v_transaction_ref,
      'wallet_synced', true,
      'order_id', p_order_id,
      'customer_name', p_client_name,
      'gross_amount', p_amount,
      'api_fee', v_api_fee,
      'net_amount', v_merchant_net
    )
  )
  RETURNING id INTO v_merchant_tx_id;

  IF v_api_fee > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
    VALUES (
      p_merchant_id, -v_api_fee, 'API_FEE',
      'Frè API 3% sou peman Kòmand #' || COALESCE(NULLIF(p_order_id, ''), 'N/A'),
      'success',
      v_transaction_ref || '-F',
      jsonb_build_object(
        'source', 'public_api',
        'gross_amount', p_amount,
        'net_amount', v_merchant_net,
        'tx_ref', v_transaction_ref,
        'order_id', p_order_id
      )
    );
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
    'net_amount', v_merchant_net
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) TO service_role;
