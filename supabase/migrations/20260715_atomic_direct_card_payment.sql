-- ============================================================================
-- RPC ATOMIK: process_direct_card_payment (pou /api/public/payments)
-- ============================================================================
-- Odit API devlopè a te jwenn ke /api/public/payments t ap fè debi kliyan an
-- ak kredi machann nan ak 2 UPDATE separe (pa atomik) — si sèvè a echwe ant
-- 2 operasyon yo (crash, timeout, elatriye), kòb la ta ka disparèt (debite
-- kliyan an san machann nan pa janm kredite), oswa yon kous (race condition)
-- ant 2 rekèt similtane ta ka double-debite/double-kredite anvan chèk balans
-- lan reyisi fè aksyon l.
--
-- Fonksyon sa a fè TOUT operasyon finansye a (chèk balans, chèk plafon,
-- anti-doublon, debi, kredi, jounal tranzaksyon) NAN YON SÈL fonksyon SQL
-- ki egzekite ATOMIKMAN, ak `FOR UPDATE` pou bloke ranje yo pandan
-- operasyon an (kont kous), nan menm lòd (pa UUID) pou 2 kont yo pou
-- evite yon "deadlock" si 2 peman rive an menm tan nan direksyon opoze.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.process_direct_card_payment(
  p_client_id UUID,
  p_merchant_id UUID,
  p_amount NUMERIC,
  p_order_id TEXT,
  p_client_name TEXT,
  p_merchant_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_balance NUMERIC;
  v_client_status TEXT;
  v_merchant_balance NUMERIC;
  v_merchant_account_type TEXT;
  v_max_balance NUMERIC;
  v_existing_tx UUID;
  v_transaction_ref TEXT;
BEGIN
  IF p_client_id = p_merchant_id THEN
    RETURN json_build_object('success', false, 'message', 'Kliyan an pa ka peye tèt li.');
  END IF;

  -- Bloke 2 ranje yo nan yon lòd DETÈMINE (pa UUID) pou evite deadlock si 2
  -- peman ant menm 2 kont yo rive an menm tan nan direksyon opoze.
  IF p_client_id < p_merchant_id THEN
    PERFORM 1 FROM public.profiles WHERE id = p_client_id FOR UPDATE;
    PERFORM 1 FROM public.profiles WHERE id = p_merchant_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.profiles WHERE id = p_merchant_id FOR UPDATE;
    PERFORM 1 FROM public.profiles WHERE id = p_client_id FOR UPDATE;
  END IF;

  SELECT wallet_balance, account_status INTO v_client_balance, v_client_status
  FROM public.profiles WHERE id = p_client_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan an pa jwenn.');
  END IF;

  IF v_client_status IS DISTINCT FROM 'active' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ki asosye ak kat sa a pa aktif.');
  END IF;

  IF COALESCE(v_client_balance, 0) < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Fon ensifizan.');
  END IF;

  -- Anti-doublon (menm modèl ak sa ki te deja fèt bò kote TypeScript, men
  -- kounye a li egzekite ATOMIKMAN anndan menm veriwou a).
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

  v_max_balance := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_merchant_balance, 0) + p_amount) > v_max_balance THEN
    RETURN json_build_object('success', false, 'message', 'Balans machann nan ta depase limit maksimòm otorize a (' || v_max_balance || ' HTG).');
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_client_id;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount WHERE id = p_merchant_id;

  v_transaction_ref := 'HTX-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));

  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (p_client_id, -p_amount, 'PURCHASE', 'Peman sou entènèt: ' || COALESCE(p_merchant_name, 'Machann') || ' (Kòmand #' || COALESCE(NULLIF(p_order_id, ''), 'N/A') || ')', 'success');

  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (p_merchant_id, p_amount, 'SALE', 'Lavant sou entènèt: Kliyan ' || COALESCE(p_client_name, 'Kliyan') || ' (Kòmand #' || COALESCE(NULLIF(p_order_id, ''), 'N/A') || ')', 'success');

  RETURN json_build_object('success', true, 'message', 'Peman an fèt ak siksè!', 'transaction_id', v_transaction_ref);
END;
$$;
