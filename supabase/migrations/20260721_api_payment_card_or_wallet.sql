-- ============================================================================
-- PEMAN API: debite card_balance an premye, sinon wallet_balance
-- ============================================================================
-- Anpil itilizatè gen lajan sou wallet (Dashboard) men card_balance = 0 paske
-- yo pa fè rechaj kat. RPC anba a aliye ak sa UI a montre epi bay mesaj klè.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  v_max_balance NUMERIC;
  v_api_receive_limit NUMERIC;
  v_existing_tx UUID;
  v_transaction_ref TEXT;
  v_debit_source TEXT;
BEGIN
  IF p_client_id = p_merchant_id THEN
    RETURN json_build_object('success', false, 'message', 'Kliyan an pa ka peye tèt li. Itilize yon lòt kont kòm kliyan pou teste API a.');
  END IF;

  IF p_client_id < p_merchant_id THEN
    PERFORM 1 FROM public.profiles WHERE id = p_client_id FOR UPDATE;
    PERFORM 1 FROM public.profiles WHERE id = p_merchant_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.profiles WHERE id = p_merchant_id FOR UPDATE;
    PERFORM 1 FROM public.profiles WHERE id = p_client_id FOR UPDATE;
  END IF;

  SELECT card_balance, wallet_balance, account_status
  INTO v_client_card_balance, v_client_wallet_balance, v_client_status
  FROM public.profiles WHERE id = p_client_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan an pa jwenn.');
  END IF;

  IF v_client_status IS DISTINCT FROM 'active' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ki asosye ak kat sa a pa aktif.');
  END IF;

  IF COALESCE(v_client_card_balance, 0) >= p_amount THEN
    v_debit_source := 'card';
  ELSIF COALESCE(v_client_wallet_balance, 0) >= p_amount THEN
    v_debit_source := 'wallet';
  ELSE
    RETURN json_build_object(
      'success', false,
      'message',
      'Fon ensifizan pou ' || p_amount || ' HTG. Balans kat: ' ||
      COALESCE(v_client_card_balance, 0) || ' HTG, balans wallet: ' ||
      COALESCE(v_client_wallet_balance, 0) || ' HTG.'
    );
  END IF;

  IF p_order_id IS NOT NULL AND p_order_id <> '' AND p_order_id <> 'N/A' THEN
    SELECT id INTO v_existing_tx FROM public.transactions
    WHERE user_id = p_merchant_id AND description LIKE '%Kòmand #' || p_order_id || '%'
    LIMIT 1;
    IF v_existing_tx IS NOT NULL THEN
      RETURN json_build_object('success', false, 'message', 'Peman sa a fèt deja pou kòmand sa a (Pwoteksyon Anti-Doublon).', 'duplicate', true);
    END IF;
  END IF;

  SELECT wallet_balance, account_type INTO v_merchant_balance, v_merchant_account_type
  FROM public.profiles WHERE id = p_merchant_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont machann nan pa jwenn.');
  END IF;

  v_api_receive_limit := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 50000 END;
  IF p_amount > v_api_receive_limit THEN
    RETURN json_build_object('success', false, 'message', 'Yon sèl peman pa ka depase limit resepsyon API a (' || v_api_receive_limit || ' HTG).');
  END IF;
  IF (COALESCE(p_daily_received_so_far, 0) + p_amount) > v_api_receive_limit THEN
    RETURN json_build_object('success', false, 'message', 'Limit resepsyon jounalye via API a depase (' || v_api_receive_limit || ' HTG).');
  END IF;

  v_max_balance := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_merchant_balance, 0) + p_amount) > v_max_balance THEN
    RETURN json_build_object('success', false, 'message', 'Balans machann nan ta depase limit maksimòm otorize a (' || v_max_balance || ' HTG).');
  END IF;

  IF v_debit_source = 'card' THEN
    UPDATE public.profiles SET card_balance = card_balance - p_amount WHERE id = p_client_id;
  ELSE
    UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_client_id;
  END IF;

  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount WHERE id = p_merchant_id;

  v_transaction_ref := 'HTX-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));

  INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
  VALUES (
    p_client_id, -p_amount, 'PURCHASE',
    'Peman sou entènèt: ' || COALESCE(p_merchant_name, 'Machann') || ' (Kòmand #' || COALESCE(NULLIF(p_order_id, ''), 'N/A') || ')',
    'success',
    jsonb_build_object('source', 'public_api', 'debit_from', v_debit_source)
  );

  INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
  VALUES (
    p_merchant_id, p_amount, 'SALE',
    'Lavant sou entènèt: Kliyan ' || COALESCE(p_client_name, 'Kliyan') || ' (Kòmand #' || COALESCE(NULLIF(p_order_id, ''), 'N/A') || ')',
    'success',
    jsonb_build_object('source', 'public_api', 'debit_from', v_debit_source)
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Peman an fèt ak siksè!',
    'transaction_id', v_transaction_ref,
    'debited_from', v_debit_source
  );
END;
$$;

-- Rechaj kat: wallet -> card (manke nan repo anvan)
CREATE OR REPLACE FUNCTION public.process_card_recharge(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  SELECT wallet_balance INTO v_wallet FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;

  IF COALESCE(v_wallet, 0) < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Balans wallet pa ase.');
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - p_amount,
      card_balance = COALESCE(card_balance, 0) + p_amount
  WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'message', 'Kat ou rechaje ak siksè!');
END;
$$;
