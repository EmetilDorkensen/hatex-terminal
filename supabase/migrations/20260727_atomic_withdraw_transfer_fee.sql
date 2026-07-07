-- ============================================================================
-- RPC ATOMIK: retrè balans ak frè transfè — pa modifye balans depi kliyan
-- ============================================================================
-- Jiskaprezan, `app/withdraw/page.tsx` ak `app/transfert/page.tsx` te kalkile
-- nouvo balans lan NAN NAVIGATÈ a (JavaScript), epi voye yon rekèt
-- `.update({ wallet_balance: <valè kalkile> })` dirèkteman bay Supabase. Yon
-- moun ki entèsepte oswa modifye rekèt sa a (devtools, Postman, elt.) ta ka
-- voye NENPÒT valè balans li vle, san sèvè a pa janm re-verifye anyen.
--
-- Fonksyon sa yo fè TOUT operasyon finansye a (verifikasyon estati kont/KYC,
-- balans, kalkil frè, debi/kredi, jounal tranzaksyon) NAN BAZ DONE a, ATOMIKMAN,
-- san yo pa janm fè konfyans nan yon "nouvo balans" ki soti nan kliyan an.
-- Paj yo ("withdraw" ak "transfert") kounye a sèlman voye MONTAN operasyon an
-- (p_amount) — janm yon balans final — epi RPC a deside/aplike rès la.
-- ============================================================================

-- ------------------------------------------------------------
-- 1. process_wallet_withdrawal — Retrè (nòmal oswa kay ajan)
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
  IF p_amount IS NULL OR p_amount < 500 THEN
    RETURN json_build_object('success', false, 'message', 'Minimòm retrè se 500 HTG.');
  END IF;

  -- Bloke ranje a pandan tout operasyon an pou evite kous (2 retrè similtane).
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

  -- CHEMEN 1: retrè nan men yon ajan (kòd 8 chif)
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

  -- CHEMEN 2: retrè nòmal (MonCash / NatCash / VIP)
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
-- 2. process_transfer_by_email — ajoute frè transfè ATOMIKMAN
-- ------------------------------------------------------------
-- Rekonstwi fonksyon ki te deja egziste a (menm non/siyati) pou l aksepte yon
-- nouvo paramèt `p_fee`: kounye a li debite montan an EPI frè a nan MENM
-- tranzaksyon SQL la, olye paj la fè yon dezyèm `.update()` apre kou pou
-- retire frè a (etap sa a te ka manipile/sote depi navigatè a).
CREATE OR REPLACE FUNCTION public.process_transfer_by_email(
  p_sender_id UUID,
  p_receiver_email TEXT,
  p_amount NUMERIC,
  p_fee NUMERIC DEFAULT 0
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
  v_sender_balance NUMERIC;
  v_receiver_balance NUMERIC;
  v_receiver_account_type TEXT;
  v_max_balance NUMERIC;
  v_total_debit NUMERIC;
BEGIN
  v_total_debit := p_amount + COALESCE(p_fee, 0);

  -- Chèche moun k ap resevwa a nan profiles (ki gen email kounye a)
  SELECT id, full_name, wallet_balance, account_type
    INTO v_receiver_id, v_receiver_name, v_receiver_balance, v_receiver_account_type
  FROM public.profiles
  WHERE email = p_receiver_email;

  IF v_receiver_id IS NULL THEN
    RAISE EXCEPTION 'Kliyan sa a pa egziste nan HatexCard.';
  END IF;

  IF v_receiver_id = p_sender_id THEN
    RAISE EXCEPTION 'Ou pa ka voye kòb bay tèt ou.';
  END IF;

  -- Jwenn enfòmasyon moun k ap voye a
  SELECT full_name, email, wallet_balance INTO v_sender_name, v_sender_email, v_sender_balance
  FROM public.profiles
  WHERE id = p_sender_id
  FOR UPDATE;

  -- Tcheke balans (montan + frè, atomikman — pa fè konfyans nan yon balans
  -- final ki ta soti nan navigatè a)
  IF COALESCE(v_sender_balance, 0) < v_total_debit THEN
    RAISE EXCEPTION 'Balans ou ensifizan.';
  END IF;

  -- 🚨 PLAFON BALANS MAKSIMÒM: kont Antrepriz (2,000,000 HTG) vs Endividyèl (105,000 HTG)
  v_max_balance := CASE WHEN v_receiver_account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_receiver_balance, 0) + p_amount) > v_max_balance THEN
    RAISE EXCEPTION 'Balans destinatè a ta depase limit maksimòm otorize a (% HTG).', v_max_balance;
  END IF;

  -- Operasyon Balans — montan an ale bay destinatè a, frè a rete/disparèt bò
  -- kote ekspeditè a sèlman (li antre nan Kès Global via tranzaksyon TRANSFER_FEE)
  UPDATE public.profiles SET wallet_balance = wallet_balance - v_total_debit WHERE id = p_sender_id;
  UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE id = v_receiver_id;

  -- Antre nan istorik (Transactions)
  INSERT INTO public.transactions (user_id, user_email, amount, type, description, status)
  VALUES (p_sender_id, p_receiver_email, -p_amount, 'P2P', 'TRANSFÈ BAY: ' || v_receiver_name, 'success');

  INSERT INTO public.transactions (user_id, user_email, amount, type, description, status)
  VALUES (v_receiver_id, v_sender_email, p_amount, 'P2P', 'TRANSFÈ NAN MEN: ' || v_sender_name, 'success');

  IF COALESCE(p_fee, 0) > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description, status)
    VALUES (p_sender_id, -p_fee, 'TRANSFER_FEE', 'Frè Transfè P2P bay ' || p_receiver_email, 'success');
  END IF;

  RETURN v_receiver_id;
END;
$$;

-- ============================================================================
-- ENPÒTAN: Apre migrasyon
-- - Kouri script sa a nan Supabase Dashboard > SQL Editor.
-- - `process_transfer_by_email` gen yon KATRYÈM paramèt NOUVO (`p_fee`, opsyonèl
--   defo 0) — sa PA kraze okenn lòt kòd ki rele l san frè.
-- - `process_wallet_withdrawal` se yon fonksyon TOUT NÈF — pa gen risk sou
--   okenn lòt entegrasyon.
-- - Apre sa, `app/withdraw/page.tsx` ak `app/transfert/page.tsx` dwe rele
--   fonksyon sa yo olye yo fè `.update()` dirèkteman sou `wallet_balance`.
-- ============================================================================
