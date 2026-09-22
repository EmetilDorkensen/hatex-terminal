-- ============================================================================
-- Retire sistèm kont AJAN nèt (tab, RPC, kolòn profiles, storage, frè).
-- ============================================================================

BEGIN;

-- 1) Gade / mete ajou fonksyon ki te touche ajan ANVAN nou retire kolòn yo
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := auth.jwt() ->> 'email';
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF v_email = 'adminhatexcard@gmail.com' THEN
    RETURN NEW;
  END IF;

  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE email = lower(v_email) AND status = 'active'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.account_type IS DISTINCT FROM OLD.account_type
     OR NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     OR NEW.is_activated IS DISTINCT FROM OLD.is_activated
     OR NEW.is_merchant IS DISTINCT FROM OLD.is_merchant
     OR NEW.enterprise_status IS DISTINCT FROM OLD.enterprise_status
     OR NEW.enterprise_fee_paid IS DISTINCT FROM OLD.enterprise_fee_paid
     OR NEW.kyc_fee_paid IS DISTINCT FROM OLD.kyc_fee_paid
     OR NEW.features_unlock_paid IS DISTINCT FROM OLD.features_unlock_paid
     OR COALESCE(NEW.pin_code_hash, '') IS DISTINCT FROM COALESCE(OLD.pin_code_hash, '')
     OR COALESCE(NEW.transaction_pin_hash, '') IS DISTINCT FROM COALESCE(OLD.transaction_pin_hash, '')
     OR COALESCE(NEW.api_key, '') IS DISTINCT FROM COALESCE(OLD.api_key, '')
     OR COALESCE(NEW.api_key_hash, '') IS DISTINCT FROM COALESCE(OLD.api_key_hash, '')
     OR COALESCE(NEW.api_key_prefix, '') IS DISTINCT FROM COALESCE(OLD.api_key_prefix, '')
     OR COALESCE(NEW.api_key_pk, '') IS DISTINCT FROM COALESCE(OLD.api_key_pk, '')
     OR COALESCE(NEW.api_key_pk_hash, '') IS DISTINCT FROM COALESCE(OLD.api_key_pk_hash, '')
     OR COALESCE(NEW.api_key_pk_prefix, '') IS DISTINCT FROM COALESCE(OLD.api_key_pk_prefix, '')
     OR COALESCE(NEW.api_key_mode, '') IS DISTINCT FROM COALESCE(OLD.api_key_mode, '')
     OR COALESCE(NEW.webhook_secret, '') IS DISTINCT FROM COALESCE(OLD.webhook_secret, '')
     OR COALESCE(NEW.webhook_url, '') IS DISTINCT FROM COALESCE(OLD.webhook_url, '')
     OR COALESCE(NEW.kyc_id_number_hash, '') IS DISTINCT FROM COALESCE(OLD.kyc_id_number_hash, '')
     OR COALESCE(NEW.current_session_token, '') IS DISTINCT FROM COALESCE(OLD.current_session_token, '')
  THEN
    RAISE EXCEPTION 'Chanjman sa a pa otorize dirèkteman. Sèvi ak operasyon ofisyèl sistèm nan.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  NEW.wallet_balance := 0;
  NEW.account_status := 'active';
  NEW.account_type := COALESCE(NULLIF(NEW.account_type, ''), 'individual');
  NEW.kyc_status := 'not_submitted';
  NEW.is_activated := false;
  NEW.is_merchant := false;
  NEW.kyc_fee_paid := false;
  NEW.features_unlock_paid := false;
  NEW.enterprise_fee_paid := false;
  NEW.enterprise_status := 'none';

  NEW.pin_code_hash := NULL;
  NEW.transaction_pin_hash := NULL;
  NEW.api_key := NULL;
  NEW.api_key_hash := NULL;
  NEW.api_key_prefix := NULL;
  NEW.api_key_pk := NULL;
  NEW.api_key_pk_hash := NULL;
  NEW.api_key_pk_prefix := NULL;
  NEW.api_key_mode := 'live';
  NEW.webhook_secret := NULL;
  NEW.webhook_url := NULL;
  NEW.kyc_id_number_hash := NULL;
  NEW.current_session_token := NULL;

  RETURN NEW;
END;
$$;

-- Apwouve antrepriz SAN bay kont ajan
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

  SELECT id, wallet_balance, account_type, enterprise_fee_paid
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
        enterprise_status = 'approved'
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

CREATE OR REPLACE FUNCTION public.admin_reset_client_account(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize. Itilize API admin.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;

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

  UPDATE public.profiles SET
    wallet_balance = 0,
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
    'Admin reyinisyalize kont lan (balans 0, antrepriz + dokiman biznis efase via Storage API, KYC kenbe)',
    jsonb_build_object(
      'kept_kyc', true,
      'purged_enterprise_docs', true,
      'storage_via', 'api'
    )
  );

  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id,
    'kept_kyc', true,
    'docs_purged_via', 'storage_api'
  );
END;
$$;

-- 2) DROP tout RPC / fonksyon ajan (tout overload)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE 'process_agent_%'
        OR p.proname LIKE 'admin_review_agent%'
        OR p.proname LIKE 'admin_credit_agent%'
        OR p.proname LIKE 'admin_review_agent_recharge%'
        OR p.proname IN (
          'agent_restart_application',
          'hatex_agent_fee',
          'hatex_purge_agent_enterprise_docs',
          'process_wallet_withdrawal',
          'transfer_wallet_to_card'
        )
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- 3) Tab ajan
DROP TABLE IF EXISTS public.agent_applications CASCADE;
DROP TABLE IF EXISTS public.agent_recharge_requests CASCADE;
DROP TABLE IF EXISTS public.agent_tiers CASCADE;

-- 4) Kolòn ajan sou profiles
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS agent_balance,
  DROP COLUMN IF EXISTS agent_capacity,
  DROP COLUMN IF EXISTS agent_guarantee_paid,
  DROP COLUMN IF EXISTS agent_status,
  DROP COLUMN IF EXISTS agent_tier,
  DROP COLUMN IF EXISTS agent_code,
  DROP COLUMN IF EXISTS is_agent,
  DROP COLUMN IF EXISTS upgrade_status;

-- 5) Frè / limit ajan nan konfig (si tab yo egziste)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_fees') THEN
    DELETE FROM public.platform_fees
    WHERE fee_key IN ('agent_fee_per_1000', 'agent_withdraw_fee_per_1000');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_limits') THEN
    DELETE FROM public.platform_limits
    WHERE limit_key IN ('agent_pro_capacity', 'agent_premium_capacity', 'agent_withdraw_share_rate');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'global_settings') THEN
    BEGIN
      UPDATE public.global_settings
      SET settings = settings
        - 'agent_fee_per_1000'
        - 'agent_withdraw_fee_per_1000'
        - 'agent_pro_capacity'
        - 'agent_premium_capacity'
        - 'agent_withdraw_share_rate'
      WHERE id = 1;
    EXCEPTION WHEN undefined_column OR others THEN
      NULL;
    END;
  END IF;
END $$;

-- 6) Storage buckets ajan
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    DELETE FROM storage.objects
    WHERE bucket_id IN ('agent_documents', 'agent-recharge-proofs');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    DELETE FROM storage.buckets
    WHERE id IN ('agent_documents', 'agent-recharge-proofs');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
