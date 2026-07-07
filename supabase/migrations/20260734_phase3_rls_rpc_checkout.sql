-- ============================================================================
-- FAZ 3 SEKIRITE — RPC LEGACY + RLS PROFILES + LOOKUP TRANSFÈ
-- ============================================================================
-- Korije RPC ki te montre `prosecdef = false` nan verifikasyon ou:
--   transfer_wallet_to_card, increment_wallet, process_subscription_payment
-- Aktive RLS sou `profiles` pou anpeche li PII lòt itilizatè yo.
-- ============================================================================

-- ============================================================
-- 1. transfer_wallet_to_card — SECURITY DEFINER + frè sou sèvè
-- ============================================================
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
  v_fee NUMERIC;
  v_total NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> user_id_input THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;
  IF amount_input IS NULL OR amount_input <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  v_fee := GREATEST(COALESCE(fee_input, 0), 0);
  v_total := amount_input + v_fee;

  SELECT wallet_balance INTO v_wallet
  FROM public.profiles WHERE id = user_id_input FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;
  IF COALESCE(v_wallet, 0) < v_total THEN
    RETURN json_build_object('success', false, 'message', 'Balans wallet pa ase (montan + frè).');
  END IF;

  UPDATE public.profiles SET
    wallet_balance = wallet_balance - v_total,
    card_balance = COALESCE(card_balance, 0) + amount_input
  WHERE id = user_id_input;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (user_id_input, 'CARD_RECHARGE', amount_input, 'success', 'Rechaj kat soti nan wallet');

  IF v_fee > 0 THEN
    INSERT INTO public.transactions (user_id, type, amount, status, description)
    VALUES (user_id_input, 'FEE', -v_fee, 'success', 'Frè rechaj kat');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Kat ou rechaje ak siksè!');
END;
$$;

-- ============================================================
-- 2. increment_wallet — sèlman service_role (cron escrow)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_wallet(
  user_id_val UUID,
  amount_val NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF amount_val IS NULL OR amount_val <= 0 THEN
    RAISE EXCEPTION 'Montan pa valab.';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Operasyon sa a pa otorize.';
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + amount_val
  WHERE id = user_id_val;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kont pa jwenn.';
  END IF;
END;
$$;

-- ============================================================
-- 3. process_subscription_payment — sèlman service_role (cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_subscription_payment(
  p_sub_id UUID,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_client_card NUMERIC;
  v_merchant_wallet NUMERIC;
  v_merchant_type TEXT;
  v_max NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', 'Operasyon sa a pa otorize.');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  SELECT id, client_id, merchant_id, amount, plan_name, shop_name, status
    INTO v_sub
  FROM public.subscriptions WHERE id = p_sub_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Abònman pa jwenn.');
  END IF;
  IF v_sub.status NOT IN ('active', 'past_due') THEN
    RETURN json_build_object('success', false, 'message', 'Abònman pa aktif.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_sub.client_id FOR UPDATE;
  PERFORM 1 FROM public.profiles WHERE id = v_sub.merchant_id FOR UPDATE;

  SELECT card_balance INTO v_client_card FROM public.profiles WHERE id = v_sub.client_id;
  IF COALESCE(v_client_card, 0) < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Balans kat kliyan an pa ase.');
  END IF;

  SELECT wallet_balance, account_type INTO v_merchant_wallet, v_merchant_type
  FROM public.profiles WHERE id = v_sub.merchant_id;

  v_max := CASE WHEN v_merchant_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_merchant_wallet, 0) + p_amount) > v_max THEN
    RETURN json_build_object('success', false, 'message', 'Balans machann nan ta depase limit maksimòm.');
  END IF;

  UPDATE public.profiles SET card_balance = card_balance - p_amount WHERE id = v_sub.client_id;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount WHERE id = v_sub.merchant_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (v_sub.client_id, 'SUBSCRIPTION', -p_amount, 'success', 'Abònman: ' || COALESCE(v_sub.plan_name, 'Plan'));

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (v_sub.merchant_id, 'SUBSCRIPTION', p_amount, 'success', 'Abònman resevwa: ' || COALESCE(v_sub.shop_name, 'Boutik'));

  RETURN json_build_object('success', true);
END;
$$;

-- ============================================================
-- 4. Lookup transfè — pa ekspoze balans lòt moun
-- ============================================================
CREATE OR REPLACE FUNCTION public.hatex_lookup_transfer_recipient(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('found', false, 'message', 'Ou dwe konekte.');
  END IF;

  SELECT id, full_name, account_type, account_status
    INTO v_row
  FROM public.profiles
  WHERE email = lower(trim(p_email))
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN json_build_object('found', false, 'message', 'Pa jwenn okenn itilizatè ak imèl sa a.');
  END IF;
  IF v_row.id = auth.uid() THEN
    RETURN json_build_object('found', false, 'message', 'Ou pa ka voye kòb bay tèt ou.');
  END IF;
  IF v_row.account_status = 'suspended' THEN
    RETURN json_build_object('found', false, 'message', 'Kont destinatè a sispandi.');
  END IF;

  RETURN json_build_object(
    'found', true,
    'id', v_row.id,
    'full_name', v_row.full_name,
    'account_type', COALESCE(v_row.account_type, 'individual')
  );
END;
$$;

-- ============================================================
-- 5. RLS sou profiles — anpeche li done lòt moun
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT USING ((auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com');

DROP POLICY IF EXISTS profiles_select_staff ON public.profiles;
CREATE POLICY profiles_select_staff ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE email = lower(auth.jwt() ->> 'email') AND status = 'active'
    )
  );

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE USING ((auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com');

DROP POLICY IF EXISTS profiles_update_staff ON public.profiles;
CREATE POLICY profiles_update_staff ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE email = lower(auth.jwt() ->> 'email') AND status = 'active'
    )
  );

-- ============================================================
-- 6. Dwa egzekisyon
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.transfer_wallet_to_card(UUID, NUMERIC, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.transfer_wallet_to_card(UUID, NUMERIC, NUMERIC) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_wallet(UUID, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_wallet(UUID, NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_wallet(UUID, NUMERIC) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.process_subscription_payment(UUID, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_subscription_payment(UUID, NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_subscription_payment(UUID, NUMERIC) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.hatex_lookup_transfer_recipient(TEXT) TO authenticated;

-- ============================================================================
-- APRE MIGRASYON — verifye:
-- SELECT proname, prosecdef FROM pg_proc
-- WHERE proname IN ('transfer_wallet_to_card','increment_wallet','process_subscription_payment');
-- Tout dwe montre prosecdef = true.
-- ============================================================================
