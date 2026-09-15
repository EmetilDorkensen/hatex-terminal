-- Fix: trigger guard_profile_* toujou refere NEW.card_number apre kolòn lan te retire.
-- Sa a bloke UPDATE profiles (egzanp apwouve KYC) ak erè:
--   record "new" has no field "card_number"

BEGIN;

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
  NEW.agent_balance := 0;
  NEW.agent_capacity := 0;
  NEW.agent_guarantee_paid := false;
  NEW.agent_status := 'none';
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
  NEW.agent_code := NULL;
  NEW.kyc_id_number_hash := NULL;
  NEW.current_session_token := NULL;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_profile_sensitive_columns() IS
  'Bloke UPDATE finans/KYC/API depi navigatè. Pa refere kolòn kat vityèl (retire).';

COMMIT;
