-- ============================================================================
-- LANSMAN FREE / 1000+ ITILIZATÈ — bouche twou kritik
-- ============================================================================

-- 1. REVOKE PUBLIC sou tout RPC finansye (anon revoke sèlman PA ase)
DO $$
DECLARE
  r RECORD;
  names TEXT[] := ARRAY[
    'process_wallet_withdrawal',
    'process_transfer_by_email',
    'process_card_recharge',
    'process_agent_activation',
    'process_agent_recharge',
    'process_agent_capacity_increase',
    'process_agent_client_deposit',
    'agent_restart_application',
    'process_enterprise_fee',
    'transfer_wallet_to_card',
    'process_subscription_card_payment',
    'hatex_lookup_transfer_recipient',
    'sync_merchant_terminal_earnings'
  ];
  n TEXT;
BEGIN
  FOREACH n IN ARRAY names LOOP
    FOR r IN
      SELECT pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = n
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', n, r.args);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', n, r.args);
    END LOOP;
  END LOOP;
END $$;

-- Re-grant authenticated pou tout overload ki ekziste (dinamik)
DO $$
DECLARE
  r RECORD;
  grant_names TEXT[] := ARRAY[
    'process_wallet_withdrawal',
    'process_transfer_by_email',
    'process_card_recharge',
    'transfer_wallet_to_card',
    'hatex_lookup_transfer_recipient',
    'sync_merchant_terminal_earnings',
    'process_agent_activation',
    'process_agent_recharge',
    'process_agent_capacity_increase',
    'process_agent_client_deposit',
    'agent_restart_application',
    'process_enterprise_fee'
  ];
  n TEXT;
BEGIN
  FOREACH n IN ARRAY grant_names LOOP
    FOR r IN
      SELECT pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = n
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', n, r.args);
    END LOOP;
  END LOOP;
END $$;

-- 2. RPC atomik: apwouve depo (evite double-kredi sou navigatè)
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(
  p_deposit_id UUID,
  p_final_amount NUMERIC DEFAULT NULL,
  p_fee NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep RECORD;
  v_amount NUMERIC;
  v_fee NUMERIC;
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_is_admin BOOLEAN;
  v_is_staff BOOLEAN;
  v_bal NUMERIC;
  v_type TEXT;
  v_max NUMERIC;
BEGIN
  v_is_admin := v_email = 'adminhatexcard@gmail.com';
  v_is_staff := EXISTS (
    SELECT 1 FROM public.staff_users WHERE email = v_email AND status = 'active'
  );
  IF NOT (v_is_admin OR v_is_staff) THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Depo pa jwenn.');
  END IF;
  IF v_dep.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Depo sa a deja trete.', 'status', v_dep.status);
  END IF;

  v_amount := COALESCE(p_final_amount, v_dep.amount);
  v_fee := COALESCE(p_fee, v_dep.fee, 0);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  SELECT wallet_balance, account_type INTO v_bal, v_type
  FROM public.profiles WHERE id = v_dep.user_id FOR UPDATE;

  v_max := CASE WHEN v_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_bal, 0) + v_amount) > v_max THEN
    RETURN json_build_object('success', false, 'message', 'Balans ta depase limit maksimòm.');
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount
  WHERE id = v_dep.user_id;

  UPDATE public.deposits
  SET status = 'approved',
      amount = v_amount,
      fee = v_fee,
      total_to_pay = COALESCE(v_dep.total_to_pay, v_amount + v_fee)
  WHERE id = p_deposit_id;

  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (v_dep.user_id, v_amount, 'DEPOSIT', 'Depo konfime: +' || v_amount || ' HTG', 'success');

  RETURN json_build_object('success', true, 'message', 'Depo apwouve.', 'amount', v_amount);
END;
$$;

-- 3. RPC: rejte depo / retrè (ranbouse si withdrawal reject)
CREATE OR REPLACE FUNCTION public.admin_reject_finance_item(
  p_table TEXT,
  p_item_id UUID,
  p_reason TEXT DEFAULT 'Rejte pa admin'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_row RECORD;
  v_refund NUMERIC;
BEGIN
  IF v_email <> 'adminhatexcard@gmail.com'
     AND NOT EXISTS (SELECT 1 FROM public.staff_users WHERE email = v_email AND status = 'active') THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  IF p_table = 'deposits' THEN
    SELECT * INTO v_row FROM public.deposits WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Pa jwenn.'); END IF;
    IF v_row.status IS DISTINCT FROM 'pending' THEN
      RETURN json_build_object('success', false, 'message', 'Deja trete.');
    END IF;
    UPDATE public.deposits SET status = 'rejected' WHERE id = p_item_id;
    INSERT INTO public.transactions (user_id, amount, type, description, status)
    VALUES (v_row.user_id, 0, 'REJECTED', 'Anile depo: ' || COALESCE(p_reason, ''), 'failed');
    RETURN json_build_object('success', true);

  ELSIF p_table = 'withdrawals' THEN
    SELECT * INTO v_row FROM public.withdrawals WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Pa jwenn.'); END IF;
    IF v_row.status IS DISTINCT FROM 'pending' THEN
      RETURN json_build_object('success', false, 'message', 'Deja trete.');
    END IF;
    -- Retrè te deja koupe kòb (RPC) — ranbouse amount + fee
    v_refund := COALESCE(v_row.amount, 0) + COALESCE(v_row.fee, 0);
    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_refund
    WHERE id = v_row.user_id;
    UPDATE public.withdrawals SET status = 'rejected' WHERE id = p_item_id;
    INSERT INTO public.transactions (user_id, amount, type, description, status)
    VALUES (v_row.user_id, 0, 'REJECTED', 'Anile retrè: ' || COALESCE(p_reason, ''), 'failed');
    RETURN json_build_object('success', true, 'refunded', v_refund);

  ELSE
    RETURN json_build_object('success', false, 'message', 'Tab pa valab.');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_complete_withdrawal(p_withdrawal_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_row RECORD;
BEGIN
  IF v_email <> 'adminhatexcard@gmail.com'
     AND NOT EXISTS (SELECT 1 FROM public.staff_users WHERE email = v_email AND status = 'active') THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  SELECT * INTO v_row FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Pa jwenn.'); END IF;
  IF v_row.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Deja trete.');
  END IF;

  UPDATE public.withdrawals SET status = 'completed' WHERE id = p_withdrawal_id;
  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (v_row.user_id, -COALESCE(v_row.amount, 0), 'WITHDRAWAL',
          'Retrè konfime: -' || v_row.amount || ' HTG', 'success');
  RETURN json_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_approve_deposit(UUID, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_approve_deposit(UUID, NUMERIC, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID, NUMERIC, NUMERIC) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_reject_finance_item(TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reject_finance_item(TEXT, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_finance_item(TEXT, UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_complete_withdrawal(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_complete_withdrawal(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_complete_withdrawal(UUID) TO authenticated;

-- 4. Rate limit atomik (pou serverless san Upstash)
CREATE OR REPLACE FUNCTION public.hatex_rate_limit_hit(
  p_key TEXT,
  p_limit INT,
  p_window_sec INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_now TIMESTAMPTZ := now();
  v_reset TIMESTAMPTZ;
  v_count INT;
BEGIN
  INSERT INTO public.rate_limits (id, count, reset_at)
  VALUES (p_key, 1, v_now + make_interval(secs => p_window_sec))
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_row FROM public.rate_limits WHERE id = p_key FOR UPDATE;

  IF v_row.reset_at <= v_now THEN
    UPDATE public.rate_limits
    SET count = 1, reset_at = v_now + make_interval(secs => p_window_sec)
    WHERE id = p_key;
    RETURN json_build_object('allowed', true, 'remaining', p_limit - 1);
  END IF;

  v_count := v_row.count + 1;
  IF v_count > p_limit THEN
    RETURN json_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_sec', GREATEST(1, EXTRACT(EPOCH FROM (v_row.reset_at - v_now))::INT)
    );
  END IF;

  UPDATE public.rate_limits SET count = v_count WHERE id = p_key;
  RETURN json_build_object('allowed', true, 'remaining', p_limit - v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_rate_limit_hit(TEXT, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hatex_rate_limit_hit(TEXT, INT, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.hatex_rate_limit_hit(TEXT, INT, INT) FROM authenticated;
-- Sèlman service_role (API sèvè) ka rele

-- ============================================================================
-- VERIFYE:
-- SELECT grantee FROM information_schema.routine_privileges
-- WHERE routine_name = 'process_wallet_withdrawal';
-- (pa dwe gen PUBLIC)
-- ============================================================================
