-- ============================================================================
-- 1) Korije retrè ajan: 20% → agent_balance (itilizab), 80% → platform_treasury
-- 2) Rechaj ajan gratis (demann + prèv) ak apwobasyon admin/kesye
-- 3) Admin/kesye kredite float ajan pa kòd (san frè) — sèlman via RPC
-- Kouri nan Supabase SQL Editor apre deploy kòd la.
-- ============================================================================

-- ============================================================
-- A. Kès Global reyèl (balans itilizab pou HatexCard)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_treasury (
  id TEXT PRIMARY KEY DEFAULT 'kes_global',
  balance NUMERIC NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.platform_treasury (id, balance)
VALUES ('kes_global', 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_treasury ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_treasury_admin_select ON public.platform_treasury;
CREATE POLICY platform_treasury_admin_select ON public.platform_treasury
  FOR SELECT USING (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(auth.jwt() ->> 'email')
        AND s.status = 'active'
        AND s.role = 'finance'
    )
  );

-- Pa gen INSERT/UPDATE pou authenticated (sèlman SECURITY DEFINER / service_role)

CREATE OR REPLACE FUNCTION public.hatex_credit_kes_global(p_amount NUMERIC, p_note TEXT DEFAULT NULL)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bal NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montan pwofi pa valab.';
  END IF;
  UPDATE public.platform_treasury
  SET balance = balance + p_amount, updated_at = now()
  WHERE id = 'kes_global'
  RETURNING balance INTO v_bal;
  IF NOT FOUND THEN
    INSERT INTO public.platform_treasury (id, balance) VALUES ('kes_global', p_amount)
    RETURNING balance INTO v_bal;
  END IF;
  RETURN v_bal;
END;
$$;

CREATE OR REPLACE FUNCTION public.hatex_debit_kes_global(p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bal NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montan debit pa valab.';
  END IF;
  SELECT balance INTO v_bal FROM public.platform_treasury WHERE id = 'kes_global' FOR UPDATE;
  IF NOT FOUND OR COALESCE(v_bal, 0) < p_amount THEN
    RAISE EXCEPTION 'Kès Global pa gen ase balans.';
  END IF;
  UPDATE public.platform_treasury
  SET balance = balance - p_amount, updated_at = now()
  WHERE id = 'kes_global'
  RETURNING balance INTO v_bal;
  RETURN v_bal;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_credit_kes_global(NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hatex_credit_kes_global(NUMERIC, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.hatex_debit_kes_global(NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hatex_debit_kes_global(NUMERIC) TO service_role;

-- ============================================================
-- B. Demann rechaj ajan (gratis — ak prèv peman)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_recharge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id UUID NOT NULL REFERENCES public.profiles(id),
  agent_code TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_account TEXT,
  proof_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_recharge_pending
  ON public.agent_recharge_requests (status, created_at DESC);

ALTER TABLE public.agent_recharge_requests ENABLE ROW LEVEL SECURITY;

-- Ajan: SELECT sèlman (pa ka INSERT/UPDATE depi navigatè — API sèvis sèlman)
DROP POLICY IF EXISTS agent_recharge_select_own ON public.agent_recharge_requests;
CREATE POLICY agent_recharge_select_own ON public.agent_recharge_requests
  FOR SELECT USING (auth.uid() = agent_user_id);

DROP POLICY IF EXISTS agent_recharge_insert_own ON public.agent_recharge_requests;
-- Pa gen INSERT pou authenticated: tout demann pase /api/agent/recharge-request (service_role)

DROP POLICY IF EXISTS agent_recharge_admin_all ON public.agent_recharge_requests;
-- Admin/kesye li atravè API (service_role) tou — pa bezwen FOR ALL nan navigatè
CREATE POLICY agent_recharge_admin_select ON public.agent_recharge_requests
  FOR SELECT USING (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(auth.jwt() ->> 'email')
        AND s.status = 'active'
        AND s.role = 'finance'
    )
  );

REVOKE ALL ON public.agent_recharge_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.agent_recharge_requests FROM authenticated;
GRANT SELECT ON public.agent_recharge_requests TO authenticated;
GRANT ALL ON public.agent_recharge_requests TO service_role;

REVOKE ALL ON public.platform_treasury FROM anon, authenticated;
GRANT SELECT ON public.platform_treasury TO authenticated;
GRANT ALL ON public.platform_treasury TO service_role;

-- ============================================================
-- C. Korije process_wallet_withdrawal — komisyon sou agent_balance + Kès
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
  v_agent_share NUMERIC;
  v_hatex_share NUMERIC;
  v_total_debit NUMERIC;
  v_is_large BOOLEAN;
  v_withdrawal_id UUID;
  v_kes NUMERIC;
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

    v_fee := ROUND((p_amount / 1000.0) * 50, 2);
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

    -- Kapasite: sèlman montan kach (komisyon ka depase ti kras kapasite a)
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

    -- Float kach + komisyon 20% → agent_balance (balans ajan itilizab pou depo)
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
        'Frè retrè ajan (50 HTG / 1,000)',
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
      v_kes := public.hatex_credit_kes_global(v_hatex_share, 'agent_withdraw_fee');
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
  v_fee := CASE WHEN v_is_large THEN 0 ELSE ROUND(p_amount * 0.05, 2) END;
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

-- ============================================================
-- D. Admin/kesye: kredite float ajan pa kòd (SAN FRÈ) — service_role sèlman
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_credit_agent_float(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.admin_credit_agent_float(
  p_agent_code TEXT,
  p_amount NUMERIC,
  p_operator_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(COALESCE(NULLIF(trim(p_operator_email), ''), ''));
  v_agent RECORD;
  v_new_bal NUMERIC;
BEGIN
  -- Sèlman service_role (API Next.js) — pa kite navigatè apele RPC dirèkteman
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize. Itilize API admin.');
  END IF;

  IF p_agent_code IS NULL OR length(trim(p_agent_code)) <> 8 THEN
    RETURN json_build_object('success', false, 'message', 'Kòd ajan invalid (8 chif).');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;
  IF p_amount > 500000 THEN
    RETURN json_build_object('success', false, 'message', 'Montan twò wo pou yon sèl rechaj.');
  END IF;

  SELECT id, agent_balance, agent_capacity, agent_status, full_name, agent_code
  INTO v_agent
  FROM public.profiles
  WHERE agent_code = trim(p_agent_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Ajan pa jwenn ak kòd sa a.');
  END IF;
  IF v_agent.agent_status IS DISTINCT FROM 'approved' THEN
    RETURN json_build_object('success', false, 'message', 'Ajan sa a pa aktif.');
  END IF;

  IF COALESCE(v_agent.agent_capacity, 0) > 0
     AND (COALESCE(v_agent.agent_balance, 0) + p_amount) > v_agent.agent_capacity THEN
    RETURN json_build_object(
      'success', false,
      'message',
      'Montan an ta depase kapasite ajan an. Rete: ' ||
        GREATEST(0, COALESCE(v_agent.agent_capacity, 0) - COALESCE(v_agent.agent_balance, 0)) || ' HTG.'
    );
  END IF;

  UPDATE public.profiles
  SET agent_balance = COALESCE(agent_balance, 0) + p_amount
  WHERE id = v_agent.id
  RETURNING agent_balance INTO v_new_bal;

  INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
  VALUES (
    v_agent.id,
    'AGENT_RECHARGE_HATEX',
    p_amount,
    'success',
    'Rechaj ajan gratis pa HatexCard (admin/kesye)',
    jsonb_build_object(
      'agent_code', trim(p_agent_code),
      'credited_by', v_email,
      'fee', 0
    )
  );

  RETURN json_build_object(
    'success', true,
    'agent_id', v_agent.id,
    'agent_name', v_agent.full_name,
    'agent_code', v_agent.agent_code,
    'amount', p_amount,
    'agent_balance', v_new_bal
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_credit_agent_float(TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_agent_float(TEXT, NUMERIC, TEXT) TO service_role;

-- ============================================================
-- E. Review demann rechaj ajan (apwouve / rejte) — service_role sèlman
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_review_agent_recharge(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.admin_review_agent_recharge(
  p_request_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL,
  p_operator_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(COALESCE(NULLIF(trim(p_operator_email), ''), ''));
  v_req RECORD;
  v_result JSON;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize. Itilize API admin.');
  END IF;

  IF p_action IS DISTINCT FROM 'approved' AND p_action IS DISTINCT FROM 'rejected' THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa valab.');
  END IF;

  SELECT * INTO v_req FROM public.agent_recharge_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Demann pa jwenn.');
  END IF;
  IF v_req.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Demann sa a deja trete.', 'status', v_req.status);
  END IF;

  IF p_action = 'rejected' THEN
    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
      RETURN json_build_object('success', false, 'message', 'Rezon rejè obligatwa.');
    END IF;
    UPDATE public.agent_recharge_requests
    SET status = 'rejected',
        rejection_reason = trim(p_reason),
        reviewed_by = v_email,
        reviewed_at = now()
    WHERE id = p_request_id;
    RETURN json_build_object('success', true, 'action', 'rejected');
  END IF;

  -- approved: kredite float san frè
  v_result := public.admin_credit_agent_float(v_req.agent_code, v_req.amount, v_email);
  IF (v_result->>'success')::boolean IS DISTINCT FROM true THEN
    RETURN v_result;
  END IF;

  UPDATE public.agent_recharge_requests
  SET status = 'approved',
      reviewed_by = v_email,
      reviewed_at = now(),
      rejection_reason = NULL
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true,
    'action', 'approved',
    'credit', v_result
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_review_agent_recharge(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_agent_recharge(UUID, TEXT, TEXT, TEXT) TO service_role;

-- Backfill Kès Global ak AGENT_WITHDRAW_FEE ki deja egziste (si treasury a 0)
DO $$
DECLARE
  v_sum NUMERIC;
  v_cur NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_sum
  FROM public.transactions
  WHERE type = 'AGENT_WITHDRAW_FEE' AND status = 'success';

  SELECT balance INTO v_cur FROM public.platform_treasury WHERE id = 'kes_global';
  IF COALESCE(v_cur, 0) = 0 AND v_sum > 0 THEN
    UPDATE public.platform_treasury SET balance = v_sum, updated_at = now() WHERE id = 'kes_global';
  END IF;
END $$;

-- Korije 20260747: komisyon te ale sou wallet_balance — deplase sou agent_balance (itilizab)
-- Deplase SELMAN kantite ki toujou sou wallet la (pa kreye kòb si yo deja depanse).
DO $$
BEGIN
  UPDATE public.profiles p
  SET
    wallet_balance = GREATEST(0, COALESCE(p.wallet_balance, 0) - moved.amt),
    agent_balance = COALESCE(p.agent_balance, 0) + moved.amt
  FROM (
    SELECT
      t.user_id,
      LEAST(
        COALESCE((SELECT wallet_balance FROM public.profiles WHERE id = t.user_id), 0),
        SUM(t.amount)::numeric
      ) AS amt
    FROM public.transactions t
    WHERE t.type = 'AGENT_COMMISSION'
      AND t.status = 'success'
      AND (
        t.description IS NULL
        OR t.description NOT LIKE '%kredite sou balans ajan%'
      )
    GROUP BY t.user_id
  ) moved
  WHERE p.id = moved.user_id
    AND moved.amt > 0;
END $$;
