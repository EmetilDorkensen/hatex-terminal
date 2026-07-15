-- ============================================================================
-- Review ajan / antrepriz atravè RPC atomik (pa update wallet_balance depi navigatè)
-- Kouri nan Supabase > SQL Editor apre deploy kòd la.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_review_agent_application(
  p_application_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_is_admin BOOLEAN;
  v_is_staff BOOLEAN;
  v_app RECORD;
  v_prof RECORD;
  v_paid NUMERIC;
  v_fee NUMERIC;
  v_refund NUMERIC;
  v_max NUMERIC;
  v_new_bal NUMERIC;
BEGIN
  IF p_action IS DISTINCT FROM 'approved' AND p_action IS DISTINCT FROM 'rejected' THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa valab.');
  END IF;

  v_is_admin := v_email = 'adminhatexcard@gmail.com';
  v_is_staff := EXISTS (
    SELECT 1 FROM public.staff_users WHERE email = v_email AND status = 'active'
  );
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT (v_is_admin OR v_is_staff) THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  SELECT * INTO v_app FROM public.agent_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Aplikasyon ajan pa jwenn.');
  END IF;
  IF v_app.user_id IS DISTINCT FROM p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Itilizatè pa matche aplikasyon an.');
  END IF;
  IF v_app.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Aplikasyon sa a deja trete.', 'status', v_app.status);
  END IF;

  IF p_action = 'rejected' AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
    RETURN json_build_object('success', false, 'message', 'Rezon rejè obligatwa.');
  END IF;

  SELECT id, wallet_balance, account_type, agent_guarantee_paid, agent_status
  INTO v_prof
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Pwofil pa jwenn.');
  END IF;

  IF p_action = 'approved' THEN
    UPDATE public.profiles
    SET agent_status = 'approved'
    WHERE id = p_user_id;

    UPDATE public.agent_applications
    SET status = 'approved', rejection_reason = NULL
    WHERE id = p_application_id;

    RETURN json_build_object('success', true, 'action', 'approved', 'refund', 0);
  END IF;

  -- rejected: ranbouse garanti + frè (7 HTG pou chak 1000) si te peye
  v_paid := COALESCE(v_prof.agent_guarantee_paid, 0);
  v_fee := CASE WHEN v_paid > 0 THEN floor((v_paid / 1000.0) * 7) ELSE 0 END;
  v_refund := v_paid + v_fee;

  IF v_refund > 0 THEN
    v_max := CASE WHEN v_prof.account_type = 'business' THEN 2000000 ELSE 105000 END;
    IF (COALESCE(v_prof.wallet_balance, 0) + v_refund) > v_max THEN
      RETURN json_build_object('success', false, 'message', 'Ranbousman ta depase limit balans maksimòm.');
    END IF;

    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_refund,
        agent_balance = 0,
        agent_capacity = 0,
        agent_guarantee_paid = 0,
        agent_status = 'rejected'
    WHERE id = p_user_id
    RETURNING wallet_balance INTO v_new_bal;

    INSERT INTO public.transactions (user_id, amount, type, description, status)
    VALUES (
      p_user_id,
      v_refund,
      'REFUND',
      'Ranbousman Aplikasyon Ajan ki Rejte (+ Frè)',
      'success'
    );
  ELSE
    UPDATE public.profiles
    SET agent_status = 'rejected',
        agent_balance = 0,
        agent_capacity = 0,
        agent_guarantee_paid = 0
    WHERE id = p_user_id;
    v_new_bal := COALESCE(v_prof.wallet_balance, 0);
  END IF;

  UPDATE public.agent_applications
  SET status = 'rejected', rejection_reason = trim(p_reason)
  WHERE id = p_application_id;

  RETURN json_build_object(
    'success', true,
    'action', 'rejected',
    'refund', v_refund,
    'wallet_balance', v_new_bal
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_enterprise_application(
  p_application_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_is_admin BOOLEAN;
  v_is_staff BOOLEAN;
  v_app RECORD;
  v_prof RECORD;
  v_fee NUMERIC;
  v_max NUMERIC;
  v_new_bal NUMERIC;
BEGIN
  IF p_action IS DISTINCT FROM 'approved' AND p_action IS DISTINCT FROM 'rejected' THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa valab.');
  END IF;

  v_is_admin := v_email = 'adminhatexcard@gmail.com';
  v_is_staff := EXISTS (
    SELECT 1 FROM public.staff_users WHERE email = v_email AND status = 'active'
  );
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT (v_is_admin OR v_is_staff) THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  SELECT * INTO v_app FROM public.enterprise_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Aplikasyon antrepriz pa jwenn.');
  END IF;
  IF v_app.user_id IS DISTINCT FROM p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Itilizatè pa matche aplikasyon an.');
  END IF;
  IF v_app.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Aplikasyon sa a deja trete.', 'status', v_app.status);
  END IF;

  IF p_action = 'rejected' AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
    RETURN json_build_object('success', false, 'message', 'Rezon rejè obligatwa.');
  END IF;

  SELECT id, wallet_balance, account_type, enterprise_fee_paid, agent_status
  INTO v_prof
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Pwofil pa jwenn.');
  END IF;

  IF p_action = 'approved' THEN
    UPDATE public.profiles
    SET account_type = 'business',
        enterprise_status = 'approved',
        agent_status = CASE
          WHEN COALESCE(agent_status, 'none') IS DISTINCT FROM 'approved' THEN 'approved'
          ELSE agent_status
        END,
        agent_tier = CASE
          WHEN COALESCE(agent_status, 'none') IS DISTINCT FROM 'approved' THEN 'pro'
          ELSE agent_tier
        END,
        agent_capacity = CASE
          WHEN COALESCE(agent_status, 'none') IS DISTINCT FROM 'approved' THEN 40000
          ELSE agent_capacity
        END,
        agent_balance = CASE
          WHEN COALESCE(agent_status, 'none') IS DISTINCT FROM 'approved' THEN 0
          ELSE agent_balance
        END,
        agent_guarantee_paid = CASE
          WHEN COALESCE(agent_status, 'none') IS DISTINCT FROM 'approved' THEN 0
          ELSE agent_guarantee_paid
        END
    WHERE id = p_user_id;

    UPDATE public.enterprise_applications
    SET status = 'approved', rejection_reason = NULL
    WHERE id = p_application_id;

    RETURN json_build_object('success', true, 'action', 'approved', 'refund', 0);
  END IF;

  -- rejected: ranbouse frè antrepriz
  v_fee := COALESCE(v_prof.enterprise_fee_paid, 0);
  IF v_fee > 0 THEN
    v_max := CASE WHEN v_prof.account_type = 'business' THEN 2000000 ELSE 105000 END;
    IF (COALESCE(v_prof.wallet_balance, 0) + v_fee) > v_max THEN
      RETURN json_build_object('success', false, 'message', 'Ranbousman ta depase limit balans maksimòm.');
    END IF;

    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_fee,
        enterprise_status = 'rejected',
        enterprise_fee_paid = 0
    WHERE id = p_user_id
    RETURNING wallet_balance INTO v_new_bal;

    INSERT INTO public.transactions (user_id, amount, type, description, status)
    VALUES (
      p_user_id,
      v_fee,
      'REFUND',
      'Ranbousman Frè Kont Antrepriz Rejte',
      'success'
    );
  ELSE
    UPDATE public.profiles
    SET enterprise_status = 'rejected',
        enterprise_fee_paid = 0
    WHERE id = p_user_id;
    v_new_bal := COALESCE(v_prof.wallet_balance, 0);
  END IF;

  UPDATE public.enterprise_applications
  SET status = 'rejected', rejection_reason = trim(p_reason)
  WHERE id = p_application_id;

  RETURN json_build_object(
    'success', true,
    'action', 'rejected',
    'refund', v_fee,
    'wallet_balance', v_new_bal
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_review_agent_application(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_review_agent_application(UUID, UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_review_agent_application(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_agent_application(UUID, UUID, TEXT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_review_enterprise_application(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_review_enterprise_application(UUID, UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_review_enterprise_application(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_enterprise_application(UUID, UUID, TEXT, TEXT) TO service_role;
