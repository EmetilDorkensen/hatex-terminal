-- Lansman: limit transfè/retrè sou sèvè + bucket prèv depo prive (chifre/SSE Supabase)

-- ============================================================
-- 1. Helpers limit depans (kont endividyèl)
-- ============================================================
CREATE OR REPLACE FUNCTION public.hatex_sum_p2p_sent_since(p_user_id UUID, p_since TIMESTAMPTZ)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(ABS(amount)), 0)
  FROM public.transactions
  WHERE user_id = p_user_id
    AND type = 'P2P'
    AND amount < 0
    AND COALESCE(status, 'success') IN ('success', 'completed')
    AND created_at >= p_since;
$$;

CREATE OR REPLACE FUNCTION public.hatex_sum_withdrawn_since(p_user_id UUID, p_since TIMESTAMPTZ)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT SUM(amount)
      FROM public.withdrawals
      WHERE user_id = p_user_id
        AND COALESCE(status, 'pending') NOT IN ('rejected', 'cancelled')
        AND created_at >= p_since
    ), 0)
    + COALESCE((
      SELECT SUM(ABS(amount))
      FROM public.transactions
      WHERE user_id = p_user_id
        AND type = 'AGENT_WITHDRAWAL_CLIENT'
        AND amount < 0
        AND COALESCE(status, 'success') IN ('success', 'completed')
        AND created_at >= p_since
    ), 0);
$$;

CREATE OR REPLACE FUNCTION public.hatex_assert_individual_spending_limit(
  p_user_id UUID,
  p_account_type TEXT,
  p_amount NUMERIC,
  p_channel TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c_daily CONSTANT NUMERIC := 75000;
  c_monthly CONSTANT NUMERIC := 250000;
  v_day_start TIMESTAMPTZ;
  v_month_start TIMESTAMPTZ;
  v_today_total NUMERIC;
  v_month_total NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montan pa valab.';
  END IF;

  -- Kont antrepriz: transfè ak retrè ilimite
  IF COALESCE(p_account_type, 'individual') = 'business'
     AND p_channel IN ('transfer', 'withdraw') THEN
    RETURN;
  END IF;

  v_day_start := date_trunc('day', NOW() AT TIME ZONE 'America/Port-au-Prince')
    AT TIME ZONE 'America/Port-au-Prince';
  v_month_start := date_trunc('month', NOW() AT TIME ZONE 'America/Port-au-Prince')
    AT TIME ZONE 'America/Port-au-Prince';

  IF p_channel = 'transfer' THEN
    v_today_total := public.hatex_sum_p2p_sent_since(p_user_id, v_day_start);
    v_month_total := public.hatex_sum_p2p_sent_since(p_user_id, v_month_start);
  ELSIF p_channel = 'withdraw' THEN
    v_today_total := public.hatex_sum_withdrawn_since(p_user_id, v_day_start);
    v_month_total := public.hatex_sum_withdrawn_since(p_user_id, v_month_start);
  ELSE
    RAISE EXCEPTION 'Kanal limit pa valab.';
  END IF;

  IF v_today_total + p_amount > c_daily THEN
    RAISE EXCEPTION 'Limit jounalye a se % HTG. Ou gentan itilize % HTG jodi a.', c_daily, v_today_total;
  END IF;

  IF v_month_total + p_amount > c_monthly THEN
    RAISE EXCEPTION 'Limit mansyèl la se % HTG. Ou gentan itilize % HTG mwa sa a.', c_monthly, v_month_total;
  END IF;
END;
$$;

-- ============================================================
-- 2. process_transfer_by_email — limit sou sèvè
-- ============================================================
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

  v_fee := public.hatex_transfer_fee(p_amount);
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

  PERFORM public.hatex_assert_individual_spending_limit(
    p_sender_id, v_sender_account_type, p_amount, 'transfer'
  );

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

REVOKE EXECUTE ON FUNCTION public.process_transfer_by_email(UUID, TEXT, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_transfer_by_email(UUID, TEXT, NUMERIC, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_transfer_by_email(UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- ============================================================
-- 3. process_wallet_withdrawal — limit sou sèvè
-- ============================================================
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
  v_is_large BOOLEAN;
  v_withdrawal_id UUID;
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

  BEGIN
    PERFORM public.hatex_assert_individual_spending_limit(p_user_id, v_account_type, p_amount, 'withdraw');
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
  END;

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

    RETURN json_build_object('success', true, 'is_agent', true, 'agent_name', v_agent.full_name, 'net_amount', v_net);
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.process_wallet_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_wallet_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 4. Bucket prive pou prèv depo (pa aksesib piblikman)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deposit-proofs',
  'deposit-proofs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880;

-- Si ansyen bucket 'proofs' egziste, fè l prive tou
UPDATE storage.buckets SET public = false WHERE id = 'proofs';

-- Pa gen policy SELECT pou deposit-proofs: sèlman service_role (API sèvè) ka li/ekri.
-- Itilizatè yo upload via /api/deposit/upload-proof; admin li via signed URL.

