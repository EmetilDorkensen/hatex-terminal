-- ============================================================================
-- Frè dinamik: admin modifye platform_fee_settings / account_fee_overrides
-- epi TOUT tranzaksyon (retrè, P2P, ajan, API) itilize yo vrèman.
-- Kouri nan Supabase SQL Editor.
-- ============================================================================

-- Asire tablo frè yo
CREATE TABLE IF NOT EXISTS public.platform_fee_settings (
  fee_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  value NUMERIC NOT NULL CHECK (value >= 0),
  unit TEXT NOT NULL DEFAULT 'flat'
    CHECK (unit IN ('flat', 'per_1000', 'percent')),
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS public.account_fee_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fee_key TEXT NOT NULL REFERENCES public.platform_fee_settings(fee_key) ON DELETE CASCADE,
  value NUMERIC NOT NULL CHECK (value >= 0),
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  UNIQUE (user_id, fee_key)
);

INSERT INTO public.platform_fee_settings (fee_key, label, value, unit, description) VALUES
  ('kyc_fee', 'Frè KYC', 1150, 'flat', 'Frè verifikasyon KYC (kat enkli)'),
  ('deposit_fee_percent', 'Frè depo kliyan', 5, 'percent', 'Frè sou depo (%) — egzanp 10000 → +500'),
  ('withdraw_fee_percent', 'Frè retrè MonCash/NatCash', 5, 'percent', 'Frè sou retrè ki pa ajan (%)'),
  ('transfer_fee_percent', 'Echèl frè P2P', 5, 'percent', '5 = tablo MonCash nòmal; 0 = gratis; 10 = doub'),
  ('agent_fee_per_1000', 'Frè ajan (aktivasyon/kapasite)', 7, 'per_1000', '7 HTG pou chak 1000 HTG'),
  ('agent_withdraw_fee_per_1000', 'Frè retrè kay ajan', 50, 'per_1000', '50 HTG / 1000 HTG kach'),
  ('api_fee_per_1000', 'Frè API resevwa', 3, 'per_1000', '3 HTG pou chak 1000 HTG API'),
  ('enterprise_application_fee', 'Frè pasaj antrepriz', 49000, 'flat', 'Frè aplikasyon kont antrepriz'),
  ('card_activation_fee', 'Frè aktivasyon kat (legacy)', 0, 'flat', '0 si KYC enkli kat')
ON CONFLICT (fee_key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description;

CREATE OR REPLACE FUNCTION public.hatex_resolve_fee(
  p_fee_key TEXT,
  p_user_id UUID DEFAULT NULL,
  p_default NUMERIC DEFAULT 0
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val NUMERIC;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT value INTO v_val
    FROM public.account_fee_overrides
    WHERE user_id = p_user_id AND fee_key = p_fee_key;
    IF FOUND THEN
      RETURN COALESCE(v_val, 0);
    END IF;
  END IF;

  SELECT value INTO v_val
  FROM public.platform_fee_settings
  WHERE fee_key = p_fee_key;
  IF FOUND THEN
    RETURN COALESCE(v_val, p_default);
  END IF;

  RETURN COALESCE(p_default, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_resolve_fee(TEXT, UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hatex_resolve_fee(TEXT, UUID, NUMERIC) TO authenticated, service_role;

-- P2P: tablo MonCash × (transfer_fee_percent / 5)
CREATE OR REPLACE FUNCTION public.hatex_transfer_fee(
  p_amount NUMERIC,
  p_user_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base NUMERIC;
  v_scale NUMERIC;
BEGIN
  v_base := CASE
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

  -- 5 = nòmal (100% tablo a). 0 = gratis. 10 = doub.
  v_scale := public.hatex_resolve_fee('transfer_fee_percent', p_user_id, 5);
  RETURN ROUND(v_base * (v_scale / 5.0), 2);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_transfer_fee(NUMERIC, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hatex_transfer_fee(NUMERIC, UUID) TO authenticated, service_role;
-- Keep 1-arg overload for old callers
CREATE OR REPLACE FUNCTION public.hatex_transfer_fee(p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.hatex_transfer_fee(p_amount, NULL);
$$;

-- Mete ajou process_transfer pou pase sender_id nan frè
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
  v_receiver_name TEXT;
  v_sender_name TEXT;
  v_sender_email TEXT;
  v_sender_status TEXT;
  v_sender_account_type TEXT;
  v_sender_balance NUMERIC;
  v_receiver_balance NUMERIC;
  v_receiver_account_type TEXT;
  v_max_balance NUMERIC;
  v_fee NUMERIC;
  v_total_debit NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_sender_id THEN
    RAISE EXCEPTION 'Ou pa gen otorizasyon pou voye kòb sou non yon lòt moun.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montan an pa valab.';
  END IF;

  -- Inyore p_fee kliyan — kalkile sou sèvè ak override kont
  v_fee := public.hatex_transfer_fee(p_amount, p_sender_id);
  v_total_debit := p_amount + v_fee;

  SELECT id, full_name, wallet_balance, account_type
    INTO v_receiver_id, v_receiver_name, v_receiver_balance, v_receiver_account_type
  FROM public.profiles
  WHERE email = lower(trim(p_receiver_email))
  FOR UPDATE;

  IF v_receiver_id IS NULL THEN
    RAISE EXCEPTION 'Kliyan sa a pa egziste nan HatexCard.';
  END IF;

  IF v_receiver_id = p_sender_id THEN
    RAISE EXCEPTION 'Ou pa ka voye kòb bay tèt ou.';
  END IF;

  SELECT full_name, email, wallet_balance, account_status, account_type
    INTO v_sender_name, v_sender_email, v_sender_balance, v_sender_status, v_sender_account_type
  FROM public.profiles
  WHERE id = p_sender_id
  FOR UPDATE;

  IF v_sender_status = 'suspended' THEN
    RAISE EXCEPTION 'Kont ou a sispandi.';
  END IF;

  BEGIN
    PERFORM public.hatex_assert_individual_spending_limit(
      p_sender_id, v_sender_account_type, p_amount, 'transfer'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
  END;

  IF COALESCE(v_sender_balance, 0) < v_total_debit THEN
    RAISE EXCEPTION 'Balans ou ensifizan.';
  END IF;

  v_max_balance := CASE WHEN v_receiver_account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_receiver_balance, 0) + p_amount) > v_max_balance THEN
    RAISE EXCEPTION 'Balans destinatè a ta depase limit maksimòm otorize a (% HTG).', v_max_balance;
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - v_total_debit WHERE id = p_sender_id;
  UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE id = v_receiver_id;

  INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
  VALUES (
    p_sender_id, -p_amount, 'P2P',
    'TRANSFÈ BAY: ' || COALESCE(v_receiver_name, 'KLIYAN'), 'success',
    jsonb_build_object('transfer_fee', v_fee, 'total_debit', v_total_debit, 'receiver_name', v_receiver_name)
  );

  INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
  VALUES (
    v_receiver_id, p_amount, 'P2P',
    'TRANSFÈ NAN MEN: ' || COALESCE(v_sender_name, 'KLIYAN'), 'success',
    jsonb_build_object('sender_name', v_sender_name)
  );

  IF v_fee > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
    VALUES (
      p_sender_id, -v_fee, 'TRANSFER_FEE', 'Frè transfè P2P', 'success',
      jsonb_build_object('hidden_from_user', true, 'receiver_name', v_receiver_name)
    );
  END IF;

  RETURN v_receiver_id;
END;
$$;

-- Retrè: frè dinamik (ajan + MonCash)
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
  v_account_type TEXT;
  v_balance NUMERIC;
  v_agent RECORD;
  v_fee NUMERIC;
  v_net NUMERIC;
  v_agent_share NUMERIC;
  v_hatex_share NUMERIC;
  v_total_debit NUMERIC;
  v_is_large BOOLEAN;
  v_withdrawal_id UUID;
  v_kes NUMERIC;
  v_agent_rate NUMERIC;
  v_withdraw_pct NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen otorizasyon pou operasyon sa a.');
  END IF;

  IF p_amount IS NULL OR p_amount < 500 THEN
    RETURN json_build_object('success', false, 'message', 'Minimòm retrè se 500 HTG.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  SELECT account_status, kyc_status, account_type, wallet_balance
    INTO v_status, v_kyc, v_account_type, v_balance
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

  IF p_method = 'Ajan' THEN
    IF p_agent_code IS NULL OR length(trim(p_agent_code)) <> 8 THEN
      RETURN json_build_object('success', false, 'message', 'Tanpri mete Kòd 8-Chif Ajan an kòrèkteman.');
    END IF;

    v_agent_rate := public.hatex_resolve_fee('agent_withdraw_fee_per_1000', p_user_id, 50);
    v_fee := ROUND((p_amount / 1000.0) * v_agent_rate, 2);
    v_agent_share := ROUND(v_fee * 0.20, 2);
    v_hatex_share := ROUND(v_fee - v_agent_share, 2);
    v_total_debit := p_amount + v_fee;
    v_net := p_amount;

    BEGIN
      PERFORM public.hatex_assert_individual_spending_limit(p_user_id, v_account_type, v_total_debit, 'withdraw');
    EXCEPTION WHEN OTHERS THEN
      RETURN json_build_object('success', false, 'message', SQLERRM);
    END;

    IF COALESCE(v_balance, 0) < v_total_debit THEN
      RETURN json_build_object(
        'success', false,
        'message',
        'Ou pa gen ase kòb. Ou bezwen ' || v_total_debit || ' HTG (montan + frè ' || v_fee || ' HTG).'
      );
    END IF;

    SELECT id, agent_balance, agent_capacity, agent_status, full_name
    INTO v_agent
    FROM public.profiles
    WHERE agent_code = trim(p_agent_code)
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

    IF COALESCE(v_agent.agent_capacity, 0) > 0
       AND (COALESCE(v_agent.agent_balance, 0) + p_amount) > v_agent.agent_capacity THEN
      RETURN json_build_object(
        'success', false,
        'message',
        'Ajan sa a pa gen ase kapasite pou trete retrè sa a.'
      );
    END IF;

    UPDATE public.profiles
    SET wallet_balance = wallet_balance - v_total_debit
    WHERE id = p_user_id;

    UPDATE public.profiles
    SET agent_balance = COALESCE(agent_balance, 0) + p_amount + v_agent_share
    WHERE id = v_agent.id;

    INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
    VALUES (
      p_user_id, 'AGENT_WITHDRAWAL_CLIENT', -p_amount, 'success',
      'Retrè kach kay ajan: ' || trim(p_agent_code),
      jsonb_build_object(
        'agent_code', trim(p_agent_code), 'agent_id', v_agent.id,
        'cash_amount', p_amount, 'fee', v_fee,
        'agent_share', v_agent_share, 'hatex_share', v_hatex_share
      )
    );

    IF v_fee > 0 THEN
      INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
      VALUES (
        p_user_id, 'AGENT_WITHDRAW_CLIENT_FEE', -v_fee, 'success',
        'Frè retrè ajan (' || v_agent_rate || ' HTG / 1,000)',
        jsonb_build_object('agent_id', v_agent.id, 'cash_amount', p_amount)
      );
    END IF;

    INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
    VALUES (
      v_agent.id, 'AGENT_WITHDRAWAL', p_amount, 'success',
      'Retrè Kliyan: ' || COALESCE(p_user_email, ''),
      jsonb_build_object(
        'client_email', p_user_email, 'client_id', p_user_id,
        'fee', v_fee, 'agent_share', v_agent_share, 'hatex_share', v_hatex_share
      )
    );

    IF v_agent_share > 0 THEN
      INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
      VALUES (
        v_agent.id, 'AGENT_COMMISSION', v_agent_share, 'success',
        'Komisyon retrè ajan (20%) — kredite sou balans ajan',
        jsonb_build_object('client_id', p_user_id, 'cash_amount', p_amount, 'fee', v_fee)
      );
    END IF;

    IF v_hatex_share > 0 THEN
      BEGIN
        v_kes := public.hatex_credit_kes_global(v_hatex_share, 'agent_withdraw_fee');
      EXCEPTION WHEN OTHERS THEN
        v_kes := NULL;
      END;
      INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
      VALUES (
        p_user_id, 'AGENT_WITHDRAW_FEE', v_hatex_share, 'success',
        'Frè HatexCard retrè ajan (80%) — Kès Global',
        jsonb_build_object(
          'agent_id', v_agent.id, 'agent_code', trim(p_agent_code),
          'cash_amount', p_amount, 'fee_total', v_fee,
          'agent_share', v_agent_share, 'hatex_share', v_hatex_share,
          'kes_global_balance', v_kes
        )
      );
    END IF;

    RETURN json_build_object(
      'success', true, 'is_agent', true, 'agent_name', v_agent.full_name,
      'cash_amount', p_amount, 'fee', v_fee,
      'agent_share', v_agent_share, 'hatex_share', v_hatex_share,
      'total_debit', v_total_debit, 'net_amount', v_net
    );
  END IF;

  BEGIN
    PERFORM public.hatex_assert_individual_spending_limit(p_user_id, v_account_type, p_amount, 'withdraw');
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
  END;

  IF COALESCE(v_balance, 0) < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase kòb sou kont ou pou montan sa a.');
  END IF;

  v_is_large := p_amount > 15000;
  v_withdraw_pct := public.hatex_resolve_fee('withdraw_fee_percent', p_user_id, 5);
  v_fee := CASE WHEN v_is_large THEN 0 ELSE ROUND(p_amount * (v_withdraw_pct / 100.0), 2) END;
  v_net := p_amount - v_fee;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_user_id;

  INSERT INTO public.withdrawals (user_id, amount, fee, net_amount, method, phone, user_email, status)
  VALUES (
    p_user_id, p_amount, v_fee, v_net,
    CASE WHEN v_is_large THEN 'VIP_LARGE_TRANSFER' ELSE p_method END,
    CASE WHEN v_is_large THEN 'Pral bay li bay Sèvis Kliyan' ELSE p_phone END,
    p_user_email, 'pending'
  )
  RETURNING id INTO v_withdrawal_id;

  RETURN json_build_object(
    'success', true, 'is_agent', false, 'is_large', v_is_large,
    'withdrawal_id', v_withdrawal_id, 'fee', v_fee, 'net_amount', v_net
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_wallet_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_wallet_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Frè antrepriz dinamik
CREATE OR REPLACE FUNCTION public.process_enterprise_fee(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet NUMERIC;
  v_status TEXT;
  v_ent_status TEXT;
  v_fee NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;

  v_fee := public.hatex_resolve_fee('enterprise_application_fee', p_user_id, 49000);

  SELECT wallet_balance, account_status, enterprise_status
  INTO v_wallet, v_status, v_ent_status
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;
  IF v_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ou a sispandi.');
  END IF;
  IF COALESCE(v_wallet, 0) < v_fee THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase kòb sou Wallet ou.');
  END IF;

  UPDATE public.profiles SET
    wallet_balance = wallet_balance - v_fee,
    enterprise_status = 'pending',
    enterprise_fee_paid = v_fee
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (p_user_id, 'ENTERPRISE_FEE', -v_fee, 'success', 'Frè Pasaj Kont Antrepriz');

  RETURN json_build_object('success', true, 'fee', v_fee);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_enterprise_fee(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_enterprise_fee(UUID) TO authenticated, service_role;
