-- ============================================================================
-- 1) Ranbousman rejè ajan/antrepriz: PA bloke sou plafon wallet
--    (se pwòp kòb kliyan an ki te deja debite — pa "nouvo" lajan)
-- 2) Admin reset: efase dokiman ajan/antrepriz nan DB + storage; kenbe KYC
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: efase fichye storage ajan/antrepriz pou yon itilizatè (pa KYC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hatex_purge_agent_enterprise_docs(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_uid TEXT := p_user_id::text;
  v_deleted INT := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  -- Fichye nan folder {userId}/ oswa ansyen non agent-{userId}-...
  WITH doomed AS (
    DELETE FROM storage.objects
    WHERE bucket_id IN ('agent_documents', 'enterprise_documents')
      AND (
        name LIKE v_uid || '/%'
        OR name LIKE 'agent-' || v_uid || '-%'
        OR name LIKE 'enterprise-' || v_uid || '-%'
        OR name LIKE '%/' || v_uid || '/%'
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM doomed;

  RETURN json_build_object('success', true, 'files_deleted', COALESCE(v_deleted, 0));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_purge_agent_enterprise_docs(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hatex_purge_agent_enterprise_docs(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Reset kont: balans 0 + purge dokiman biznis/ajan; KYC rete
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_client_account(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purge JSON;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize. Itilize API admin.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;

  -- Efase fichye storage (agent + enterprise). Bucket kyc_documents PA manyen.
  v_purge := public.hatex_purge_agent_enterprise_docs(p_user_id);

  -- Efase referans dokiman nan aplikasyon ajan
  UPDATE public.agent_applications
  SET
    id_doc_url = NULL,
    address_doc_url = NULL,
    location_photo_url = NULL,
    patente_url = NULL,
    cif_url = NULL,
    selfie_with_id_url = NULL,
    criminal_record_url = NULL,
    bank_statement_url = NULL,
    lease_doc_url = NULL,
    status = 'rejected',
    rejection_reason = COALESCE(rejection_reason, 'Admin reyinisyalize kont lan'),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('docs_purged', true, 'purged_at', now())
  WHERE user_id = p_user_id;

  -- Efase referans dokiman antrepriz
  UPDATE public.enterprise_applications
  SET
    patente_url = NULL,
    cif_url = NULL,
    business_registration_url = NULL,
    bank_statement_url = NULL,
    lease_doc_url = NULL,
    legal_rep_id_url = NULL,
    status = 'rejected',
    rejection_reason = COALESCE(rejection_reason, 'Admin reyinisyalize kont lan'),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('docs_purged', true, 'purged_at', now())
  WHERE user_id = p_user_id;

  -- Balans zewo — KYC (kyc_status, kyc_front, kyc_selfie, kyc_fee_paid, elatriye) rete
  UPDATE public.profiles SET
    wallet_balance = 0,
    card_balance = 0,
    agent_balance = 0,
    agent_capacity = 0,
    agent_guarantee_paid = 0,
    agent_status = NULL,
    agent_tier = NULL,
    agent_code = NULL,
    upgrade_status = 'none',
    account_type = 'individual',
    business_name = NULL,
    enterprise_status = 'none',
    enterprise_fee_paid = 0
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
  VALUES (
    p_user_id,
    'ADMIN_ACCOUNT_RESET',
    0,
    'success',
    'Admin reyinisyalize kont lan (balans 0, ajan/antrepriz + dokiman biznis efase, KYC kenbe)',
    jsonb_build_object(
      'kept_kyc', true,
      'purged_agent_enterprise_docs', true,
      'purge_result', v_purge
    )
  );

  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id,
    'kept_kyc', true,
    'docs_purged', v_purge
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_client_account(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_client_account(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Review ajan: ranbousman san blòk plafon (pwòp kòb)
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
  v_is_upgrade BOOLEAN;
  v_funds_held BOOLEAN;
  v_paid NUMERIC := 0;
  v_fee NUMERIC := 0;
  v_held_paid NUMERIC := 0;
  v_held_fee NUMERIC := 0;
  v_refund NUMERIC := 0;
  v_topup NUMERIC := 0;
  v_total NUMERIC := 0;
  v_new_bal NUMERIC;
BEGIN
  IF p_action NOT IN ('approved', 'rejected') THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa valab.');
  END IF;

  v_is_admin := v_email = 'adminhatexcard@gmail.com';
  v_is_staff := EXISTS (
    SELECT 1 FROM public.staff_users WHERE email = v_email AND status = 'active'
  );
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT (v_is_admin OR v_is_staff) THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  SELECT * INTO v_app
  FROM public.agent_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND OR v_app.user_id IS DISTINCT FROM p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Aplikasyon ajan pa jwenn.');
  END IF;
  IF v_app.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Aplikasyon sa a deja trete.', 'status', v_app.status);
  END IF;
  IF p_action = 'rejected' AND length(trim(COALESCE(p_reason, ''))) = 0 THEN
    RETURN json_build_object('success', false, 'message', 'Rezon rejè obligatwa.');
  END IF;

  SELECT * INTO v_prof
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Pwofil pa jwenn.');
  END IF;

  v_is_upgrade := lower(COALESCE(v_app.application_type, 'new')) = 'upgrade';
  v_funds_held := COALESCE(v_app.metadata->>'funds_held', 'false') = 'true';

  BEGIN
    IF v_is_upgrade THEN
      v_paid := COALESCE((v_app.metadata->>'upgrade_deposit')::numeric, 0);
    ELSE
      v_paid := COALESCE(v_prof.agent_guarantee_paid, 0);
    END IF;
    v_fee := COALESCE((v_app.metadata->>'fee_paid')::numeric, 0);
  EXCEPTION WHEN OTHERS THEN
    v_paid := CASE WHEN v_is_upgrade THEN 0 ELSE COALESCE(v_prof.agent_guarantee_paid, 0) END;
    v_fee := 0;
  END;

  IF v_is_upgrade THEN
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_held_paid
    FROM public.transactions
    WHERE user_id = p_user_id
      AND type = 'AGENT_GUARANTEE'
      AND status = 'success'
      AND metadata->>'application_id' = p_application_id::text;

    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_held_fee
    FROM public.transactions
    WHERE user_id = p_user_id
      AND type = 'FEE'
      AND status = 'success'
      AND metadata->>'application_id' = p_application_id::text;

    IF v_funds_held THEN
      IF v_held_paid > 0 THEN
        v_paid := v_held_paid;
        v_fee := v_held_fee;
      ELSIF v_paid <= 0 THEN
        v_funds_held := false;
      ELSIF v_held_paid <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'Prèv peman upgrade Premium nan pa matche.');
      END IF;
    ELSIF v_held_paid > 0 THEN
      v_funds_held := true;
      v_paid := v_held_paid;
      v_fee := v_held_fee;
    END IF;

    IF NOT v_funds_held THEN
      IF p_action = 'rejected' THEN
        UPDATE public.profiles SET upgrade_status = 'rejected' WHERE id = p_user_id;
        UPDATE public.agent_applications
        SET status = 'rejected', rejection_reason = trim(p_reason)
        WHERE id = p_application_id;
        RETURN json_build_object(
          'success', true, 'action', 'rejected', 'upgrade', true, 'legacy', true,
          'refund', 0, 'fee_refunded', 0
        );
      END IF;

      v_topup := GREATEST(0, 110000 - COALESCE(v_prof.agent_guarantee_paid, 0));
      v_fee := public.hatex_agent_fee(v_topup, p_user_id);
      v_total := v_topup + v_fee;

      IF COALESCE(v_prof.wallet_balance, 0) < v_total THEN
        RETURN json_build_object(
          'success', false,
          'message', 'Ajan an bezwen ' || to_char(v_topup, 'FM999,999,990') ||
            ' HTG + ' || to_char(v_fee, 'FM999,999,990') ||
            ' HTG frè sou Wallet pou finalize Premium.'
        );
      END IF;

      UPDATE public.profiles
      SET wallet_balance = wallet_balance - v_total,
          agent_tier = 'premium',
          agent_capacity = 110000,
          agent_guarantee_paid = COALESCE(agent_guarantee_paid, 0) + v_topup,
          agent_balance = COALESCE(agent_balance, 0) + v_topup,
          upgrade_status = 'approved'
      WHERE id = p_user_id;

      IF v_topup > 0 THEN
        INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
        VALUES (
          p_user_id, 'AGENT_GUARANTEE', -v_topup, 'success',
          'Finalize upgrade Ajan PREMIUM (admin apwouve)',
          jsonb_build_object('application_id', p_application_id, 'upgrade_deposit', v_topup)
        );
      END IF;
      IF v_fee > 0 THEN
        INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
        VALUES (
          p_user_id, 'FEE', -v_fee, 'success',
          'Frè aktivasyon upgrade Ajan PREMIUM (admin apwouve)',
          jsonb_build_object('application_id', p_application_id, 'fee_paid', v_fee, 'category', 'agent_activation')
        );
      END IF;

      UPDATE public.agent_applications
      SET status = 'approved', rejection_reason = NULL,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'upgrade_deposit', v_topup, 'fee_paid', v_fee, 'funds_held', false, 'charged_on_approve', true
          )
      WHERE id = p_application_id;

      RETURN json_build_object(
        'success', true, 'action', 'approved', 'upgrade', true, 'legacy', true,
        'capacity_added', v_topup, 'fee', v_fee, 'refund', 0, 'fee_refunded', 0
      );
    END IF;

    IF p_action = 'approved' THEN
      UPDATE public.profiles
      SET agent_tier = 'premium',
          agent_capacity = 110000,
          agent_guarantee_paid = COALESCE(agent_guarantee_paid, 0) + v_paid,
          agent_balance = COALESCE(agent_balance, 0) + v_paid,
          upgrade_status = 'approved'
      WHERE id = p_user_id;

      UPDATE public.agent_applications
      SET status = 'approved', rejection_reason = NULL,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('funds_held', false)
      WHERE id = p_application_id;

      RETURN json_build_object(
        'success', true, 'action', 'approved', 'upgrade', true,
        'capacity_added', v_paid, 'refund', 0, 'fee_refunded', 0
      );
    END IF;

    -- Rejte + ranbouse (pa gen plafon — se pwòp kòb)
    v_refund := GREATEST(0, COALESCE(v_paid, 0) + COALESCE(v_fee, 0));

    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_refund,
        upgrade_status = 'rejected'
    WHERE id = p_user_id
    RETURNING wallet_balance INTO v_new_bal;

    IF v_refund > 0 THEN
      INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
      VALUES (
        p_user_id, v_refund, 'REFUND',
        'Ranbousman upgrade Ajan PREMIUM rejte', 'success',
        jsonb_build_object(
          'application_id', p_application_id,
          'guarantee_refunded', v_paid,
          'fee_refunded', v_fee,
          'category', 'agent_premium_upgrade',
          'balance_cap_exempt', true
        )
      );
    END IF;

    IF v_fee > 0 THEN
      INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
      VALUES (
        p_user_id, v_fee, 'FEE_REFUND',
        'Ranbousman frè upgrade Ajan PREMIUM', 'success',
        jsonb_build_object(
          'application_id', p_application_id,
          'category', 'agent_activation',
          'reviewed_by', NULLIF(v_email, '')
        )
      );
    END IF;

    UPDATE public.agent_applications
    SET status = 'rejected', rejection_reason = trim(p_reason),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('funds_held', false)
    WHERE id = p_application_id;

    RETURN json_build_object(
      'success', true, 'action', 'rejected', 'upgrade', true,
      'refund', v_refund, 'fee_refunded', v_fee,
      'guarantee_refunded', v_paid, 'wallet_balance', v_new_bal
    );
  END IF;

  -- Premye aktivasyon PRO/PREMIUM
  IF p_action = 'approved' THEN
    UPDATE public.profiles SET agent_status = 'approved' WHERE id = p_user_id;
    UPDATE public.agent_applications
    SET status = 'approved', rejection_reason = NULL
    WHERE id = p_application_id;
    RETURN json_build_object('success', true, 'action', 'approved', 'refund', 0, 'fee_refunded', 0);
  END IF;

  SELECT ABS(amount) INTO v_held_fee
  FROM public.transactions
  WHERE user_id = p_user_id
    AND type = 'FEE'
    AND status = 'success'
    AND (
      description ILIKE '%aktivasyon%Ajan%'
      OR description ILIKE '%aktivasyon Ajan%'
      OR COALESCE(metadata->>'category', '') = 'agent_activation'
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF COALESCE(v_held_fee, 0) > 0 THEN
    v_fee := v_held_fee;
  ELSE
    v_fee := GREATEST(0, v_fee);
  END IF;

  v_refund := GREATEST(0, COALESCE(v_paid, 0) + COALESCE(v_fee, 0));

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_refund,
      agent_balance = 0,
      agent_capacity = 0,
      agent_guarantee_paid = 0,
      agent_status = 'rejected',
      agent_tier = NULL,
      agent_code = NULL,
      upgrade_status = 'none'
  WHERE id = p_user_id
  RETURNING wallet_balance INTO v_new_bal;

  IF v_refund > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
    VALUES (
      p_user_id, v_refund, 'REFUND',
      'Ranbousman Aplikasyon Ajan ki Rejte (garanti + frè)', 'success',
      jsonb_build_object(
        'application_id', p_application_id,
        'guarantee_refunded', v_paid,
        'fee_refunded', v_fee,
        'category', 'agent_rejection',
        'balance_cap_exempt', true
      )
    );
  END IF;

  IF v_fee > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
    VALUES (
      p_user_id, v_fee, 'FEE_REFUND',
      'Ranbousman frè ajan (soti nan pwofi HatexCard)', 'success',
      jsonb_build_object(
        'application_id', p_application_id,
        'category', 'agent_activation',
        'reviewed_by', NULLIF(v_email, '')
      )
    );
  END IF;

  UPDATE public.agent_applications
  SET status = 'rejected', rejection_reason = trim(p_reason)
  WHERE id = p_application_id;

  RETURN json_build_object(
    'success', true,
    'action', 'rejected',
    'refund', v_refund,
    'fee_refunded', v_fee,
    'guarantee_refunded', COALESCE(v_paid, 0),
    'wallet_balance', v_new_bal
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Review antrepriz: ranbousman san blòk plafon
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
          WHEN COALESCE(agent_status, 'none') IS DISTINCT FROM 'approved' THEN 55000
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

  SELECT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE type IN ('FEE_REFUND', 'REFUND')
      AND status = 'success'
      AND COALESCE(metadata->>'application_id', '') = p_application_id::text
  ) INTO v_dup_refund;

  IF v_dup_refund THEN
    UPDATE public.profiles
    SET enterprise_status = 'rejected', enterprise_fee_paid = 0, account_type = 'individual'
    WHERE id = p_user_id;
    UPDATE public.enterprise_applications
    SET status = 'rejected', rejection_reason = trim(p_reason)
    WHERE id = p_application_id;
    RETURN json_build_object('success', true, 'action', 'rejected', 'refund', 0, 'fee_refunded', 0);
  END IF;

  IF v_fee > 0 THEN
    -- Pa bloke sou plafon: se ranbousman frè li te peye a
    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_fee,
        enterprise_status = 'rejected',
        enterprise_fee_paid = 0,
        account_type = 'individual'
    WHERE id = p_user_id
    RETURNING wallet_balance INTO v_new_bal;

    INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
    VALUES (
      p_user_id, v_fee, 'REFUND',
      'Ranbousman Frè Kont Antrepriz Rejte', 'success',
      jsonb_build_object(
        'application_id', p_application_id,
        'fee_refunded', v_fee,
        'category', 'enterprise_rejection',
        'balance_cap_exempt', true
      )
    );

    INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
    VALUES (
      p_user_id, v_fee, 'FEE_REFUND',
      'Ranbousman frè antrepriz (soti nan pwofi HatexCard)', 'success',
      jsonb_build_object(
        'application_id', p_application_id,
        'category', 'enterprise',
        'reviewed_by', NULLIF(v_email, '')
      )
    );
  ELSE
    UPDATE public.profiles
    SET enterprise_status = 'rejected', enterprise_fee_paid = 0, account_type = 'individual'
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

NOTIFY pgrst, 'reload schema';
