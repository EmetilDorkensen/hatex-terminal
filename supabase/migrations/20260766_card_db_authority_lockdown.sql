-- ============================================================
-- HatexCard — Kat chifre + otorite baz done
-- 1) Guard UPDATE elaji (aktivasyon, friz, last4, frè…)
-- 2) Guard INSERT (pa fo balans/kat nan enskripsyon)
-- 3) Navigatè pa ka SELECT/UPDATE PAN/CVV/hash sekrè
--    (API service_role sèlman)
-- Kouri nan Supabase > SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- 1) UPDATE guard
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
     OR COALESCE(NEW.webhook_secret, '') IS DISTINCT FROM COALESCE(OLD.webhook_secret, '')
     OR COALESCE(NEW.agent_code, '') IS DISTINCT FROM COALESCE(OLD.agent_code, '')
     OR COALESCE(NEW.kyc_id_number_hash, '') IS DISTINCT FROM COALESCE(OLD.kyc_id_number_hash, '')
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
-- 2) INSERT guard
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
  NEW.webhook_secret := NULL;
  NEW.agent_code := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_insert ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_insert();

-- ------------------------------------------------------------
-- 3) PAN/CVV/hash: navigatè pa ka li ni ekri (sèlman service_role)
--    Pa revoke account_status elatriye — staff workspace bezwen yo.
-- ------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    REVOKE SELECT (
      card_number, cvv, card_number_hash, cvv_hash,
      pin_code_hash, transaction_pin_hash,
      api_key, api_key_hash, webhook_secret,
      kyc_id_number_hash, current_session_token
    ) ON public.profiles FROM authenticated;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'REVOKE SELECT authenticated: %', SQLERRM;
  END;

  BEGIN
    REVOKE SELECT (
      card_number, cvv, card_number_hash, cvv_hash,
      pin_code_hash, transaction_pin_hash,
      api_key, api_key_hash, webhook_secret,
      kyc_id_number_hash, current_session_token
    ) ON public.profiles FROM anon;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'REVOKE SELECT anon: %', SQLERRM;
  END;

  BEGIN
    REVOKE UPDATE (
      card_number, cvv, card_number_hash, cvv_hash
    ) ON public.profiles FROM authenticated;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'REVOKE UPDATE authenticated: %', SQLERRM;
  END;

  BEGIN
    REVOKE UPDATE (
      card_number, cvv, card_number_hash, cvv_hash
    ) ON public.profiles FROM anon;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'REVOKE UPDATE anon: %', SQLERRM;
  END;
END $$;

COMMENT ON FUNCTION public.guard_profile_sensitive_columns() IS
  'Bloke UPDATE finans/kat/KYC/aktivasyon depi navigatè (pa admin/staff).';
COMMENT ON FUNCTION public.guard_profile_sensitive_insert() IS
  'Fòse pwofil nouvo san balans/kat/privilèj fo.';
