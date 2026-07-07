-- ============================================================================
-- SEKIRIZE RPC FINANSYE YO — verifye moun k ap rele a + rekalkile frè sou sèvè
-- ============================================================================
-- Pwoblèm ki korije isit la (odit pre-lansman):
--   1. IDOR: `process_wallet_withdrawal`, `process_transfer_by_email` ak
--      `process_card_recharge` te aksepte yon UUID kliyan (`p_user_id` /
--      `p_sender_id`) SAN yo pa verifye si se VRÈMAN moun sa a k ap rele a.
--      Yon itilizatè konekte te ka pase UUID yon LÒT moun epi retire/voye kòb
--      li. Kounye a chak fonksyon egzije `auth.uid()` matche ak pwopriyetè a.
--   2. Frè transfè: paj la te voye `p_fee` depi navigatè a — yon moun te ka
--      voye `p_fee: 0`. Kounye a sèvè a REKALKILE frè a li menm epi inyore
--      valè kliyan an voye a.
--   3. Validasyon: montan negatif/zero bloke; estati kont/KYC ekspeditè tcheke.
--   4. Kous: ranje destinatè a bloke ak FOR UPDATE.
--   5. Dwa: REVOKE sou anon; sèlman `authenticated` (+ service_role) ka rele yo.
--
-- NÒT: `auth.uid()` NULL lè yon route sèvè rele fonksyon an ak SERVICE ROLE —
-- nan ka sa a nou kite l pase (sèvè a deja verifye idantite a). Se sèlman yon
-- JWT itilizatè (anon/authenticated) ki dwe matche ak pwopriyetè liy lan.
-- ============================================================================

-- ------------------------------------------------------------
-- Helper: frè transfè P2P (menm tablo ak app/transfert/page.tsx)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hatex_transfer_fee(p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_amount BETWEEN 100 AND 249 THEN 0
    WHEN p_amount BETWEEN 250 AND 499 THEN 5
    WHEN p_amount BETWEEN 500 AND 999 THEN 10
    WHEN p_amount BETWEEN 1000 AND 1999 THEN 25
    WHEN p_amount BETWEEN 2000 AND 3999 THEN 35
    WHEN p_amount BETWEEN 4000 AND 7999 THEN 50
    WHEN p_amount BETWEEN 8000 AND 11999 THEN 60
    WHEN p_amount BETWEEN 12000 AND 19999 THEN 70
    WHEN p_amount BETWEEN 20000 AND 39999 THEN 75
    WHEN p_amount BETWEEN 40000 AND 59999 THEN 100
    WHEN p_amount BETWEEN 60000 AND 74999 THEN 120
    WHEN p_amount BETWEEN 75000 AND 100000 THEN 130
    ELSE 0
  END;
$$;

-- ------------------------------------------------------------
-- 1. process_wallet_withdrawal — ajoute verifikasyon auth.uid()
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_wallet_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_phone TEXT DEFAULT NULL,
  p_agent_code TEXT DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_kyc TEXT;
  v_balance NUMERIC;
  v_agent RECORD;
  v_fee NUMERIC;
  v_net NUMERIC;
  v_is_large BOOLEAN;
  v_withdrawal_id UUID;
BEGIN
  -- 🔒 Verifye ki moun k ap rele: yon itilizatè konekte pa ka retire lajan
  -- sou kont yon lòt moun. (auth.uid() NULL = apèl sèvè service_role, otorize.)
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen otorizasyon pou operasyon sa a.');
  END IF;

  IF p_amount IS NULL OR p_amount < 500 THEN
    RETURN json_build_object('success', false, 'message', 'Minimòm retrè se 500 HTG.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  SELECT account_status, kyc_status, wallet_balance
    INTO v_status, v_kyc, v_balance
  FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Sistèm nan pa jwenn kont ou pou verifye l.');
  END IF;

  IF v_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ou a sispandi. Ou pa gen otorizasyon pou w fè retrè.');
  END IF;

  IF v_kyc IS DISTINCT FROM 'approved' THEN
    RETURN json_build_object('success', false, 'message', 'Ou dwe pase KYC anvan ou ka fè retrè.');
  END IF;

  IF COALESCE(v_balance, 0) < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase kòb sou kont ou pou montan sa a.');
  END IF;

  v_is_large := p_amount > 15000;
  v_fee := CASE WHEN v_is_large THEN 0 ELSE ROUND(p_amount * 0.05, 2) END;
  v_net := p_amount - v_fee;

  IF p_method = 'Ajan' THEN
    IF p_agent_code IS NULL OR length(p_agent_code) <> 8 THEN
      RETURN json_build_object('success', false, 'message', 'Tanpri mete Kòd 8-Chif Ajan an kòrèkteman.');
    END IF;

    SELECT id, agent_balance, agent_status, full_name INTO v_agent
    FROM public.profiles WHERE agent_code = p_agent_code
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'message', 'Sistèm nan pa jwenn okenn ajan ak kòd sa a.');
    END IF;

    IF v_agent.agent_status IS DISTINCT FROM 'approved' THEN
      RETURN json_build_object('success', false, 'message', 'Ajan sa a pa aktif kounye a.');
    END IF;

    IF v_agent.id = p_user_id THEN
      RETURN json_build_object('success', false, 'message', 'Ou pa ka fè retrè sou pwòp kòd ajan pa w la.');
    END IF;

    UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_user_id;
    UPDATE public.profiles SET agent_balance = COALESCE(agent_balance, 0) + p_amount WHERE id = v_agent.id;

    INSERT INTO public.transactions (user_id, type, amount, status, description)
    VALUES (p_user_id, 'AGENT_WITHDRAWAL_CLIENT', -p_amount, 'success', 'Retrè kach kay ajan: ' || p_agent_code);

    INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
    VALUES (v_agent.id, 'AGENT_WITHDRAWAL', p_amount, 'success', 'Retrè Kliyan: ' || COALESCE(p_user_email, ''), jsonb_build_object('client_email', p_user_email));

    RETURN json_build_object(
      'success', true,
      'is_agent', true,
      'agent_name', v_agent.full_name,
      'net_amount', v_net
    );
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_user_id;

  INSERT INTO public.withdrawals (user_id, amount, fee, net_amount, method, phone, user_email, status)
  VALUES (
    p_user_id,
    p_amount,
    v_fee,
    v_net,
    CASE WHEN v_is_large THEN 'VIP_LARGE_TRANSFER' ELSE p_method END,
    CASE WHEN v_is_large THEN 'Pral bay li bay Sèvis Kliyan' ELSE p_phone END,
    p_user_email,
    'pending'
  )
  RETURNING id INTO v_withdrawal_id;

  RETURN json_build_object(
    'success', true,
    'is_agent', false,
    'is_large', v_is_large,
    'withdrawal_id', v_withdrawal_id,
    'fee', v_fee,
    'net_amount', v_net
  );
END;
$$;

-- ------------------------------------------------------------
-- 2. process_transfer_by_email — auth.uid() + frè rekalkile sou sèvè
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_transfer_by_email(
  p_sender_id UUID,
  p_receiver_email TEXT,
  p_amount NUMERIC,
  p_fee NUMERIC DEFAULT 0   -- KENBE pou konpatibilite; sèvè a inyore l epi rekalkile
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receiver_id UUID;
  v_sender_name TEXT;
  v_receiver_name TEXT;
  v_sender_email TEXT;
  v_sender_status TEXT;
  v_sender_balance NUMERIC;
  v_receiver_balance NUMERIC;
  v_receiver_account_type TEXT;
  v_max_balance NUMERIC;
  v_fee NUMERIC;
  v_total_debit NUMERIC;
BEGIN
  -- 🔒 Verifye ekspeditè a se vrèman moun k ap rele a
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_sender_id THEN
    RAISE EXCEPTION 'Ou pa gen otorizasyon pou voye kòb sou non yon lòt moun.';
  END IF;

  -- Validasyon montan
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montan an pa valab.';
  END IF;

  -- 🔒 Frè a REKALKILE sou sèvè a — nou pa fè konfyans nan p_fee kliyan an voye
  v_fee := public.hatex_transfer_fee(p_amount);
  v_total_debit := p_amount + v_fee;

  -- Bloke ranje destinatè a pou evite kous sou plafon balans lan
  SELECT id, full_name, wallet_balance, account_type
    INTO v_receiver_id, v_receiver_name, v_receiver_balance, v_receiver_account_type
  FROM public.profiles
  WHERE email = p_receiver_email
  FOR UPDATE;

  IF v_receiver_id IS NULL THEN
    RAISE EXCEPTION 'Kliyan sa a pa egziste nan HatexCard.';
  END IF;

  IF v_receiver_id = p_sender_id THEN
    RAISE EXCEPTION 'Ou pa ka voye kòb bay tèt ou.';
  END IF;

  SELECT full_name, email, wallet_balance, account_status
    INTO v_sender_name, v_sender_email, v_sender_balance, v_sender_status
  FROM public.profiles
  WHERE id = p_sender_id
  FOR UPDATE;

  IF v_sender_status = 'suspended' THEN
    RAISE EXCEPTION 'Kont ou a sispandi.';
  END IF;

  IF COALESCE(v_sender_balance, 0) < v_total_debit THEN
    RAISE EXCEPTION 'Balans ou ensifizan.';
  END IF;

  v_max_balance := CASE WHEN v_receiver_account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_receiver_balance, 0) + p_amount) > v_max_balance THEN
    RAISE EXCEPTION 'Balans destinatè a ta depase limit maksimòm otorize a (% HTG).', v_max_balance;
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - v_total_debit WHERE id = p_sender_id;
  UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE id = v_receiver_id;

  INSERT INTO public.transactions (user_id, user_email, amount, type, description, status)
  VALUES (p_sender_id, p_receiver_email, -p_amount, 'P2P', 'TRANSFÈ BAY: ' || v_receiver_name, 'success');

  INSERT INTO public.transactions (user_id, user_email, amount, type, description, status)
  VALUES (v_receiver_id, v_sender_email, p_amount, 'P2P', 'TRANSFÈ NAN MEN: ' || v_sender_name, 'success');

  IF v_fee > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description, status)
    VALUES (p_sender_id, -v_fee, 'TRANSFER_FEE', 'Frè Transfè P2P bay ' || p_receiver_email, 'success');
  END IF;

  RETURN v_receiver_id;
END;
$$;

-- ------------------------------------------------------------
-- 3. process_card_recharge — ajoute verifikasyon auth.uid()
-- ------------------------------------------------------------
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
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen otorizasyon pou operasyon sa a.');
  END IF;

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

-- ------------------------------------------------------------
-- 4. Dwa egzekisyon: retire aksè anon, kenbe authenticated/service_role
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.process_wallet_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_transfer_by_email(UUID, TEXT, NUMERIC, NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_card_recharge(UUID, NUMERIC) FROM anon;

GRANT EXECUTE ON FUNCTION public.process_wallet_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_transfer_by_email(UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_card_recharge(UUID, NUMERIC) TO authenticated;

-- ============================================================================
-- APRE MIGRASYON:
-- - Kouri fichye sa a nan Supabase Dashboard > SQL Editor.
-- - Okenn chanjman siyati fonksyon; app la kontinye rele yo menm jan.
-- - `p_fee` toujou aksepte men li INYORE — frè a kalkile sou sèvè a kounye a.
-- ============================================================================
