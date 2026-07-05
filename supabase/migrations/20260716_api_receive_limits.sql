-- ============================================================================
-- LIMIT RESEPSYON API + IDEMPOTENCY (pou /api/public/payments)
-- ============================================================================
-- 1. Kolòn `metadata` sou `transactions` (defansif — pou nou ka tag peman ki
--    soti nan API piblik la ak {"source":"public_api"} san chanje `type`).
-- 2. Tab `api_idempotency_keys` pou sipòte header `Idempotency-Key` (menm jan
--    ak Stripe): si machann nan voye menm kle a de fwa, nou pa refè peman an.
-- 3. Rekonstwi `process_direct_card_payment` pou ajoute yon PLAFON RESEPSYON
--    (50,000 HTG kont endividyèl / 2,000,000 HTG kont antrepriz), tou de pa
--    tranzaksyon E pa jou, verifye ATOMIKMAN anndan veriwou a (kont kous), epi
--    tag tranzaksyon kredi machann nan ak {"source":"public_api"}.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. metadata sou transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Tab idempotency
CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, idempotency_key)
);

ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Sèlman service-role (API a) ka li/ekri isit la; pa gen politik pou itilizatè
-- nòmal, kidonk RLS bloke tout aksè dirèk kliyan (an sekirite pa default).

-- Endèks pou netwayaj pita (opsyonèl)
CREATE INDEX IF NOT EXISTS idx_api_idempotency_created ON public.api_idempotency_keys (created_at);

-- 3. Rekonstwi RPC atomik la ak plafon resepsyon
-- (DROP anvan paske nou ajoute yon nouvo paramèt — evite anbigwite siyati.)
DROP FUNCTION IF EXISTS public.process_direct_card_payment(uuid, uuid, numeric, text, text, text);
DROP FUNCTION IF EXISTS public.process_direct_card_payment(uuid, uuid, numeric, text, text, text, numeric);

CREATE OR REPLACE FUNCTION public.process_direct_card_payment(
  p_client_id UUID,
  p_merchant_id UUID,
  p_amount NUMERIC,
  p_order_id TEXT,
  p_client_name TEXT,
  p_merchant_name TEXT,
  p_daily_received_so_far NUMERIC DEFAULT 0
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
  v_api_receive_limit NUMERIC;
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

  -- 🚨 PLAFON RESEPSYON API: pa-tranzaksyon E pa-jou
  v_api_receive_limit := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 50000 END;
  IF p_amount > v_api_receive_limit THEN
    RETURN json_build_object('success', false, 'message', 'Yon sèl peman pa ka depase limit resepsyon API a (' || v_api_receive_limit || ' HTG).');
  END IF;
  IF (COALESCE(p_daily_received_so_far, 0) + p_amount) > v_api_receive_limit THEN
    RETURN json_build_object('success', false, 'message', 'Limit resepsyon jounalye via API a depase (' || v_api_receive_limit || ' HTG).');
  END IF;

  -- 🚨 PLAFON BALANS MAKSIMÒM
  v_max_balance := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_merchant_balance, 0) + p_amount) > v_max_balance THEN
    RETURN json_build_object('success', false, 'message', 'Balans machann nan ta depase limit maksimòm otorize a (' || v_max_balance || ' HTG).');
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_client_id;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount WHERE id = p_merchant_id;

  v_transaction_ref := 'HTX-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));

  INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
  VALUES (p_client_id, -p_amount, 'PURCHASE', 'Peman sou entènèt: ' || COALESCE(p_merchant_name, 'Machann') || ' (Kòmand #' || COALESCE(NULLIF(p_order_id, ''), 'N/A') || ')', 'success', jsonb_build_object('source', 'public_api'));

  INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
  VALUES (p_merchant_id, p_amount, 'SALE', 'Lavant sou entènèt: Kliyan ' || COALESCE(p_client_name, 'Kliyan') || ' (Kòmand #' || COALESCE(NULLIF(p_order_id, ''), 'N/A') || ')', 'success', jsonb_build_object('source', 'public_api'));

  RETURN json_build_object('success', true, 'message', 'Peman an fèt ak siksè!', 'transaction_id', v_transaction_ref);
END;
$$;
