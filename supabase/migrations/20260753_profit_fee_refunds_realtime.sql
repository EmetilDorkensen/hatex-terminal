-- ============================================================================
-- Pwofi biznis: FEE_REFUND pou ranbousman frè (egzakteman sa ki te chaje)
-- Tablo pwofi = gross frè - FEE_REFUND - retrè pwofi
-- ============================================================================

ALTER TABLE public.agent_applications
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Review ajan: ranbouse garanti + frè egzak; FEE_REFUND = pòsyon frè sèlman
-- ---------------------------------------------------------------------------
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
  v_fee NUMERIC := 0;
  v_fee_from_meta NUMERIC;
  v_fee_from_tx NUMERIC;
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
    UPDATE public.profiles SET agent_status = 'approved' WHERE id = p_user_id;
    UPDATE public.agent_applications
    SET status = 'approved', rejection_reason = NULL
    WHERE id = p_application_id;
    RETURN json_build_object('success', true, 'action', 'approved', 'refund', 0, 'fee_refunded', 0);
  END IF;

  -- Garanti (pa pwofi Hatex) + frè egzak ki te chaje
  v_paid := COALESCE(v_prof.agent_guarantee_paid, 0);

  BEGIN
    v_fee_from_meta := NULLIF((COALESCE(v_app.metadata, '{}'::jsonb)->>'fee_paid')::numeric, 0);
  EXCEPTION WHEN OTHERS THEN
    v_fee_from_meta := NULL;
  END;

  SELECT ABS(amount) INTO v_fee_from_tx
  FROM public.transactions
  WHERE user_id = p_user_id
    AND type = 'FEE'
    AND status = 'success'
    AND (
      description ILIKE '%aktivasyon%'
      OR description ILIKE '%Ajan%'
      OR description ILIKE '%kapasite%'
    )
  ORDER BY created_at DESC
  LIMIT 1;

  v_fee := COALESCE(
    v_fee_from_meta,
    NULLIF(v_fee_from_tx, 0),
    CASE WHEN v_paid > 0 THEN public.hatex_agent_fee(v_paid, p_user_id) ELSE 0 END
  );

  IF v_fee < 0 THEN
    v_fee := 0;
  END IF;

  v_refund := COALESCE(v_paid, 0) + COALESCE(v_fee, 0);

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
        agent_status = 'rejected',
        agent_tier = NULL,
        agent_code = NULL
    WHERE id = p_user_id
    RETURNING wallet_balance INTO v_new_bal;

    INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
    VALUES (
      p_user_id,
      v_refund,
      'REFUND',
      'Ranbousman Aplikasyon Ajan ki Rejte (garanti + frè)',
      'success',
      jsonb_build_object(
        'application_id', p_application_id,
        'guarantee_refunded', v_paid,
        'fee_refunded', v_fee,
        'category', 'agent_rejection'
      )
    );

    -- Sèlman pòsyon FRÈ a sòti nan pwofi biznis (garanti pa t janm nan pwofi)
    IF v_fee > 0 THEN
      INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
      VALUES (
        p_user_id,
        v_fee,
        'FEE_REFUND',
        'Ranbousman frè ajan (soti nan pwofi HatexCard)',
        'success',
        jsonb_build_object(
          'application_id', p_application_id,
          'category', 'agent_activation',
          'reviewed_by', NULLIF(v_email, '')
        )
      );
    END IF;
  ELSE
    UPDATE public.profiles
    SET agent_status = 'rejected',
        agent_balance = 0,
        agent_capacity = 0,
        agent_guarantee_paid = 0,
        agent_tier = NULL,
        agent_code = NULL
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
    'fee_refunded', COALESCE(v_fee, 0),
    'guarantee_refunded', COALESCE(v_paid, 0),
    'wallet_balance', v_new_bal
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Review antrepriz: ranbouse egzakteman enterprise_fee_paid + FEE_REFUND
-- ---------------------------------------------------------------------------
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
  v_fee_charged NUMERIC;
  v_dup_refund BOOLEAN;
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

    RETURN json_build_object('success', true, 'action', 'approved', 'refund', 0, 'fee_refunded', 0);
  END IF;

  -- Egzakteman sa ki te peye (pa plis pase sa ki te chaje nan dènye ENTERPRISE_FEE)
  v_fee := COALESCE(v_prof.enterprise_fee_paid, 0);
  SELECT ABS(amount) INTO v_fee_charged
  FROM public.transactions
  WHERE user_id = p_user_id AND type = 'ENTERPRISE_FEE' AND status = 'success'
  ORDER BY created_at DESC
  LIMIT 1;
  v_fee_charged := COALESCE(v_fee_charged, 0);

  IF v_fee <= 0 THEN
    v_fee := v_fee_charged;
  ELSIF v_fee_charged > 0 AND v_fee > v_fee_charged THEN
    v_fee := v_fee_charged;
  END IF;

  -- Pa ranbouse 2 fwa pou MENM aplikasyon an
  SELECT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE type IN ('FEE_REFUND', 'REFUND')
      AND status = 'success'
      AND (
        COALESCE(metadata->>'application_id', '') = p_application_id::text
      )
  ) INTO v_dup_refund;

  IF v_dup_refund THEN
    UPDATE public.profiles
    SET enterprise_status = 'rejected',
        enterprise_fee_paid = 0,
        account_type = 'individual'
    WHERE id = p_user_id;
    UPDATE public.enterprise_applications
    SET status = 'rejected', rejection_reason = trim(p_reason)
    WHERE id = p_application_id;
    RETURN json_build_object(
      'success', true,
      'action', 'rejected',
      'refund', 0,
      'fee_refunded', 0,
      'message', 'Ranbousman te deja fèt pou aplikasyon sa a.'
    );
  END IF;

  IF v_fee > 0 THEN
    v_max := CASE WHEN v_prof.account_type = 'business' THEN 2000000 ELSE 105000 END;
    IF (COALESCE(v_prof.wallet_balance, 0) + v_fee) > v_max THEN
      RETURN json_build_object('success', false, 'message', 'Ranbousman ta depase limit balans maksimòm.');
    END IF;

    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_fee,
        enterprise_status = 'rejected',
        enterprise_fee_paid = 0,
        account_type = 'individual'
    WHERE id = p_user_id
    RETURNING wallet_balance INTO v_new_bal;

    INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
    VALUES (
      p_user_id,
      v_fee,
      'REFUND',
      'Ranbousman Frè Kont Antrepriz Rejte',
      'success',
      jsonb_build_object(
        'application_id', p_application_id,
        'fee_refunded', v_fee,
        'category', 'enterprise_rejection'
      )
    );

    INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
    VALUES (
      p_user_id,
      v_fee,
      'FEE_REFUND',
      'Ranbousman frè antrepriz (soti nan pwofi HatexCard)',
      'success',
      jsonb_build_object(
        'application_id', p_application_id,
        'category', 'enterprise',
        'reviewed_by', NULLIF(v_email, '')
      )
    );
  ELSE
    UPDATE public.profiles
    SET enterprise_status = 'rejected',
        enterprise_fee_paid = 0,
        account_type = 'individual'
    WHERE id = p_user_id;
    v_new_bal := COALESCE(v_prof.wallet_balance, 0);
  END IF;

  UPDATE public.enterprise_applications
  SET status = 'rejected', rejection_reason = trim(p_reason)
  WHERE id = p_application_id;

  RETURN json_build_object(
    'success', true,
    'action', 'rejected',
    'refund', COALESCE(v_fee, 0),
    'fee_refunded', COALESCE(v_fee, 0),
    'wallet_balance', v_new_bal
  );
END;
$$;

-- Backfill FEE_REFUND pou ansyen ranbousman antrepriz (si poko gen FEE_REFUND)
INSERT INTO public.transactions (user_id, amount, type, description, status, metadata, created_at)
SELECT
  t.user_id,
  ABS(t.amount),
  'FEE_REFUND',
  'Backfill: ranbousman frè antrepriz',
  'success',
  jsonb_build_object('category', 'enterprise', 'backfill', true, 'source_refund_id', t.id),
  t.created_at
FROM public.transactions t
WHERE t.type = 'REFUND'
  AND t.status = 'success'
  AND (
    t.description ILIKE '%Antrepriz%'
    OR t.description ILIKE '%enterprise%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions f
    WHERE f.type = 'FEE_REFUND'
      AND f.user_id = t.user_id
      AND f.status = 'success'
      AND ABS(f.amount - ABS(t.amount)) < 0.01
      AND ABS(EXTRACT(EPOCH FROM (f.created_at - t.created_at))) < 120
  );

NOTIFY pgrst, 'reload schema';
