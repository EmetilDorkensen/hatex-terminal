-- ============================================================================
-- HatexCard — Sekirite API / Plugin / Verifikasyon + RLS ranfòse
-- ============================================================================
-- Objektif:
--   1) Pa kite kle API sekrè an tèks klè nan profiles (sèlman HMAC hash)
--   2) Bloke navigatè a pou li/modifye hash sekrè, webhook secret, MonCash raw
--   3) Gard UPDATE/INSERT profiles pou api_key_pk* / api_key_mode
--   4) Notifikasyon: kliyan ka make li sèlman (pa modifye tit/kò)
--   5) Asire RLS aktif sou tout tab sansib gateway / KYC / webhook
--
-- Nòt: chifreman/HMAC kle yo fèt nan aplikasyon (lib/security/api-key.ts).
-- Baz la pa dwe janm kenbe hx_live_... an klè lè hash la deja la.
-- ============================================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Netwayaj: efase ansyen kle API an klè si hash deja la
-- ------------------------------------------------------------
UPDATE public.profiles
SET api_key = NULL
WHERE api_key IS NOT NULL
  AND api_key_hash IS NOT NULL;

COMMENT ON COLUMN public.profiles.api_key IS
  'DEPRECATED — pa kenbe kle an klè. Sèvi ak api_key_hash (HMAC). Dwe toujou NULL apre migrasyon.';
COMMENT ON COLUMN public.profiles.api_key_hash IS
  'HMAC-SHA256(API_KEY_HASH_SECRET, kle) — verifikasyon plugin/API. Pa ekspoze nan navigatè.';
COMMENT ON COLUMN public.profiles.api_key_pk IS
  'Kle publishable (pk_live_...) — ka ekspoze nan front; pa otorize peman.';
COMMENT ON COLUMN public.profiles.api_key_pk_hash IS
  'HMAC hash kle publishable — sèlman sèvè. Pa SELECT soti navigatè.';

-- ------------------------------------------------------------
-- 2) Guard UPDATE profiles — elaji pou API / plugin / verifikasyon
-- ------------------------------------------------------------
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
     OR NEW.card_balance IS DISTINCT FROM OLD.card_balance
     OR NEW.agent_balance IS DISTINCT FROM OLD.agent_balance
     OR NEW.agent_capacity IS DISTINCT FROM OLD.agent_capacity
     OR NEW.agent_guarantee_paid IS DISTINCT FROM OLD.agent_guarantee_paid
     OR NEW.agent_status IS DISTINCT FROM OLD.agent_status
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.account_type IS DISTINCT FROM OLD.account_type
     OR NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     OR NEW.is_activated IS DISTINCT FROM OLD.is_activated
     OR NEW.is_merchant IS DISTINCT FROM OLD.is_merchant
     OR NEW.enterprise_status IS DISTINCT FROM OLD.enterprise_status
     OR NEW.enterprise_fee_paid IS DISTINCT FROM OLD.enterprise_fee_paid
     OR NEW.kyc_fee_paid IS DISTINCT FROM OLD.kyc_fee_paid
     OR NEW.features_unlock_paid IS DISTINCT FROM OLD.features_unlock_paid
     OR NEW.is_card_activated IS DISTINCT FROM OLD.is_card_activated
     OR NEW.is_card_frozen IS DISTINCT FROM OLD.is_card_frozen
     OR COALESCE(NEW.card_number, '') IS DISTINCT FROM COALESCE(OLD.card_number, '')
     OR COALESCE(NEW.card_number_hash, '') IS DISTINCT FROM COALESCE(OLD.card_number_hash, '')
     OR COALESCE(NEW.cvv, '') IS DISTINCT FROM COALESCE(OLD.cvv, '')
     OR COALESCE(NEW.cvv_hash, '') IS DISTINCT FROM COALESCE(OLD.cvv_hash, '')
     OR COALESCE(NEW.card_last4, '') IS DISTINCT FROM COALESCE(OLD.card_last4, '')
     OR COALESCE(NEW.exp_date, '') IS DISTINCT FROM COALESCE(OLD.exp_date, '')
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
     OR COALESCE(NEW.agent_code, '') IS DISTINCT FROM COALESCE(OLD.agent_code, '')
     OR COALESCE(NEW.kyc_id_number_hash, '') IS DISTINCT FROM COALESCE(OLD.kyc_id_number_hash, '')
     OR COALESCE(NEW.current_session_token, '') IS DISTINCT FROM COALESCE(OLD.current_session_token, '')
  THEN
    RAISE EXCEPTION 'Chanjman sa a pa otorize dirèkteman. Sèvi ak operasyon ofisyèl sistèm nan.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_columns();

-- ------------------------------------------------------------
-- 3) Guard INSERT profiles — pa fo kle / webhook / KYC hash
-- ------------------------------------------------------------
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
  NEW.card_balance := 0;
  NEW.agent_balance := 0;
  NEW.agent_capacity := 0;
  NEW.agent_guarantee_paid := false;
  NEW.agent_status := 'none';
  NEW.account_status := 'active';
  NEW.account_type := COALESCE(NULLIF(NEW.account_type, ''), 'individual');
  NEW.kyc_status := 'not_submitted';
  NEW.is_activated := false;
  NEW.is_merchant := false;
  NEW.is_card_activated := false;
  NEW.is_card_frozen := false;
  NEW.kyc_fee_paid := false;
  NEW.features_unlock_paid := false;
  NEW.enterprise_fee_paid := false;
  NEW.enterprise_status := 'none';

  NEW.card_number := NULL;
  NEW.cvv := NULL;
  NEW.card_number_hash := NULL;
  NEW.cvv_hash := NULL;
  NEW.card_last4 := NULL;
  NEW.exp_date := NULL;
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
  NEW.agent_code := NULL;
  NEW.kyc_id_number_hash := NULL;
  NEW.current_session_token := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_insert ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_insert();

-- ------------------------------------------------------------
-- 4) REVOKE SELECT/UPDATE — sekrè profiles (navigatè)
--    api_key_pk rete SELECT (publishable by design)
-- ------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    REVOKE SELECT (
      card_number, cvv, card_number_hash, cvv_hash,
      pin_code_hash, transaction_pin_hash,
      api_key, api_key_hash, api_key_pk_hash,
      webhook_secret, webhook_url,
      kyc_id_number_hash, current_session_token
    ) ON public.profiles FROM authenticated;
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'REVOKE profiles SELECT authenticated (kolòn): %', SQLERRM;
  WHEN OTHERS THEN
    RAISE NOTICE 'REVOKE profiles SELECT authenticated: %', SQLERRM;
  END;

  BEGIN
    REVOKE SELECT (
      card_number, cvv, card_number_hash, cvv_hash,
      pin_code_hash, transaction_pin_hash,
      api_key, api_key_hash, api_key_pk_hash,
      webhook_secret, webhook_url,
      kyc_id_number_hash, current_session_token
    ) ON public.profiles FROM anon;
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'REVOKE profiles SELECT anon (kolòn): %', SQLERRM;
  WHEN OTHERS THEN
    RAISE NOTICE 'REVOKE profiles SELECT anon: %', SQLERRM;
  END;

  BEGIN
    REVOKE UPDATE (
      card_number, cvv, card_number_hash, cvv_hash,
      api_key, api_key_hash, api_key_prefix,
      api_key_pk, api_key_pk_hash, api_key_pk_prefix, api_key_mode,
      webhook_secret, webhook_url,
      pin_code_hash, transaction_pin_hash,
      kyc_id_number_hash, current_session_token,
      kyc_status, is_merchant, is_card_activated
    ) ON public.profiles FROM authenticated;
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'REVOKE profiles UPDATE authenticated (kolòn): %', SQLERRM;
  WHEN OTHERS THEN
    RAISE NOTICE 'REVOKE profiles UPDATE authenticated: %', SQLERRM;
  END;

  BEGIN
    REVOKE UPDATE (
      card_number, cvv, card_number_hash, cvv_hash,
      api_key, api_key_hash, api_key_prefix,
      api_key_pk, api_key_pk_hash, api_key_pk_prefix, api_key_mode,
      webhook_secret, webhook_url,
      pin_code_hash, transaction_pin_hash,
      kyc_id_number_hash, current_session_token,
      kyc_status, is_merchant, is_card_activated
    ) ON public.profiles FROM anon;
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'REVOKE profiles UPDATE anon (kolòn): %', SQLERRM;
  WHEN OTHERS THEN
    RAISE NOTICE 'REVOKE profiles UPDATE anon: %', SQLERRM;
  END;
END $$;

-- ------------------------------------------------------------
-- 5) hatex_api_keys — pa ekspoze key_hash nan navigatè
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.hatex_api_keys') IS NOT NULL THEN
    ALTER TABLE public.hatex_api_keys ENABLE ROW LEVEL SECURITY;

    BEGIN
      REVOKE SELECT (key_hash) ON public.hatex_api_keys FROM authenticated;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE hatex_api_keys.key_hash authenticated: %', SQLERRM;
    END;
    BEGIN
      REVOKE SELECT (key_hash) ON public.hatex_api_keys FROM anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE hatex_api_keys.key_hash anon: %', SQLERRM;
    END;

    -- Pa INSERT/UPDATE/DELETE dirèk — sèlman service_role / API
    BEGIN
      REVOKE INSERT, UPDATE, DELETE ON public.hatex_api_keys FROM authenticated, anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE hatex_api_keys write: %', SQLERRM;
    END;

    DROP POLICY IF EXISTS hak_owner_select ON public.hatex_api_keys;
    CREATE POLICY hak_owner_select ON public.hatex_api_keys
      FOR SELECT TO authenticated
      USING (merchant_id = auth.uid());

    COMMENT ON COLUMN public.hatex_api_keys.key_hash IS
      'HMAC kle sekrè — sèlman service_role ka li. Navigatè wè prefix sèlman.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6) developer_webhook_endpoints — pa ekspoze secret
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.developer_webhook_endpoints') IS NOT NULL THEN
    ALTER TABLE public.developer_webhook_endpoints ENABLE ROW LEVEL SECURITY;

    BEGIN
      REVOKE SELECT (secret) ON public.developer_webhook_endpoints FROM authenticated;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE dwe.secret authenticated: %', SQLERRM;
    END;
    BEGIN
      REVOKE SELECT (secret) ON public.developer_webhook_endpoints FROM anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE dwe.secret anon: %', SQLERRM;
    END;

    BEGIN
      REVOKE INSERT, UPDATE, DELETE ON public.developer_webhook_endpoints FROM authenticated, anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE dwe write: %', SQLERRM;
    END;

    DROP POLICY IF EXISTS "dwe_owner_select" ON public.developer_webhook_endpoints;
    DROP POLICY IF EXISTS dwe_owner_select ON public.developer_webhook_endpoints;
    CREATE POLICY dwe_owner_select ON public.developer_webhook_endpoints
      FOR SELECT TO authenticated
      USING (merchant_id = auth.uid());
  END IF;

  IF to_regclass('public.developer_webhook_deliveries') IS NOT NULL THEN
    ALTER TABLE public.developer_webhook_deliveries ENABLE ROW LEVEL SECURITY;
    BEGIN
      REVOKE INSERT, UPDATE, DELETE ON public.developer_webhook_deliveries FROM authenticated, anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE dwd write: %', SQLERRM;
    END;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 7) hatex_payments / hatex_payouts — kache MonCash raw / token
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.hatex_payments') IS NOT NULL THEN
    ALTER TABLE public.hatex_payments ENABLE ROW LEVEL SECURITY;

    BEGIN
      REVOKE SELECT (moncash_token, moncash_raw) ON public.hatex_payments FROM authenticated;
    EXCEPTION WHEN undefined_column THEN
      RAISE NOTICE 'REVOKE hp moncash cols: %', SQLERRM;
    WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE hp moncash authenticated: %', SQLERRM;
    END;
    BEGIN
      REVOKE SELECT (moncash_token, moncash_raw) ON public.hatex_payments FROM anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE hp moncash anon: %', SQLERRM;
    END;

    BEGIN
      REVOKE INSERT, UPDATE, DELETE ON public.hatex_payments FROM authenticated, anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE hp write: %', SQLERRM;
    END;

    DROP POLICY IF EXISTS hp_merchant_select ON public.hatex_payments;
    CREATE POLICY hp_merchant_select ON public.hatex_payments
      FOR SELECT TO authenticated
      USING (merchant_id = auth.uid());
  END IF;

  IF to_regclass('public.hatex_payouts') IS NOT NULL THEN
    ALTER TABLE public.hatex_payouts ENABLE ROW LEVEL SECURITY;

    BEGIN
      REVOKE SELECT (moncash_raw) ON public.hatex_payouts FROM authenticated;
    EXCEPTION WHEN undefined_column THEN
      RAISE NOTICE 'REVOKE hpo moncash_raw: %', SQLERRM;
    WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE hpo moncash authenticated: %', SQLERRM;
    END;
    BEGIN
      REVOKE SELECT (moncash_raw) ON public.hatex_payouts FROM anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE hpo moncash anon: %', SQLERRM;
    END;

    BEGIN
      REVOKE INSERT, UPDATE, DELETE ON public.hatex_payouts FROM authenticated, anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE hpo write: %', SQLERRM;
    END;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 8) KYC v2 — hash ID pa ekspoze; RLS + pa write dirèk
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.hatex_kyc_applications') IS NOT NULL THEN
    ALTER TABLE public.hatex_kyc_applications ENABLE ROW LEVEL SECURITY;

    BEGIN
      REVOKE SELECT (id_number_hash) ON public.hatex_kyc_applications FROM authenticated;
    EXCEPTION WHEN undefined_column THEN
      RAISE NOTICE 'REVOKE hka id_number_hash: %', SQLERRM;
    WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE hka id_number_hash authenticated: %', SQLERRM;
    END;
    BEGIN
      REVOKE SELECT (id_number_hash) ON public.hatex_kyc_applications FROM anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE hka id_number_hash anon: %', SQLERRM;
    END;

    BEGIN
      REVOKE INSERT, UPDATE, DELETE ON public.hatex_kyc_applications FROM authenticated, anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE hka write: %', SQLERRM;
    END;

    DROP POLICY IF EXISTS hka_owner_select ON public.hatex_kyc_applications;
    CREATE POLICY hka_owner_select ON public.hatex_kyc_applications
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());

    -- Staff aktif ka li dosye (workspace) san write dirèk
    DROP POLICY IF EXISTS hka_staff_select ON public.hatex_kyc_applications;
    CREATE POLICY hka_staff_select ON public.hatex_kyc_applications
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.staff_users s
          WHERE s.email = lower(auth.jwt() ->> 'email')
            AND s.status = 'active'
        )
        OR lower(auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com'
      );

    COMMENT ON COLUMN public.hatex_kyc_applications.id_number_hash IS
      'HMAC nimewo ID — verifikasyon nan baz; pa SELECT nan navigatè.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 9) Notifikasyon — make li sèlman (pa modifye mesaj)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_notification_owner_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.href IS DISTINCT FROM OLD.href
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Ou ka make notifikasyon an li sèlman.';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.hatex_notifications') IS NOT NULL THEN
    ALTER TABLE public.hatex_notifications ENABLE ROW LEVEL SECURITY;

    DROP TRIGGER IF EXISTS trg_guard_notification_owner_update ON public.hatex_notifications;
    CREATE TRIGGER trg_guard_notification_owner_update
      BEFORE UPDATE ON public.hatex_notifications
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_notification_owner_update();

    DROP POLICY IF EXISTS notif_owner_read ON public.hatex_notifications;
    CREATE POLICY notif_owner_read ON public.hatex_notifications
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());

    DROP POLICY IF EXISTS notif_owner_update ON public.hatex_notifications;
    CREATE POLICY notif_owner_update ON public.hatex_notifications
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());

    BEGIN
      REVOKE INSERT, DELETE ON public.hatex_notifications FROM authenticated, anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE notif insert/delete: %', SQLERRM;
    END;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 10) Asire RLS sou lòt tab sansib gateway / plugin / verifikasyon
-- ------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hatex_merchant_accounts',
    'hatex_gateway_settings',
    'hatex_moncash_alerts',
    'hatex_bank_accounts',
    'hatex_payout_attempts',
    'hatex_merchant_disputes',
    'kyc_survey_tokens',
    'kyc_survey_responses',
    'kyc_survey_sends',
    'api_idempotency_keys',
    'checkout_payment_locks'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- Kont machann: SELECT pwopriyetè sèlman; write sèvè
DO $$
BEGIN
  IF to_regclass('public.hatex_merchant_accounts') IS NOT NULL THEN
    DROP POLICY IF EXISTS hma_owner_select ON public.hatex_merchant_accounts;
    CREATE POLICY hma_owner_select ON public.hatex_merchant_accounts
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
    BEGIN
      REVOKE INSERT, UPDATE, DELETE ON public.hatex_merchant_accounts FROM authenticated, anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE hma write: %', SQLERRM;
    END;
  END IF;
END $$;

-- Alèt MonCash / gateway settings: pa gen policy authenticated = sèlman service_role
DO $$
BEGIN
  IF to_regclass('public.hatex_moncash_alerts') IS NOT NULL THEN
    BEGIN
      REVOKE ALL ON public.hatex_moncash_alerts FROM authenticated, anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE moncash_alerts: %', SQLERRM;
    END;
  END IF;
  IF to_regclass('public.hatex_gateway_settings') IS NOT NULL THEN
    BEGIN
      REVOKE ALL ON public.hatex_gateway_settings FROM authenticated, anon;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'REVOKE gateway_settings: %', SQLERRM;
    END;
  END IF;
END $$;

COMMENT ON FUNCTION public.guard_profile_sensitive_columns() IS
  'Bloke UPDATE finans/kat/KYC/API/plugin/webhook depi navigatè (pa admin/staff).';
COMMENT ON FUNCTION public.guard_profile_sensitive_insert() IS
  'Fòse pwofil nouvo san balans/kat/kle API/webhook/privilèj fo.';
COMMENT ON FUNCTION public.guard_notification_owner_update() IS
  'Kliyan ka chanje read_at sèlman sou hatex_notifications.';

COMMIT;
