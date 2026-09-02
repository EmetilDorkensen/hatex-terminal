-- 20260781_subscription_plans.sql
-- Abonnman (gratis / kapasite / premyòm), limit jou, payout MonCash failover

BEGIN;

-- ============================================================
-- 1. PLAN SOU PROFIL
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan TEXT,
  ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS plan_selected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intended_plan TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check
  CHECK (plan IS NULL OR plan IN ('free', 'capacity', 'premium'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_status_check
  CHECK (plan_status IN (
    'none', 'active', 'pending_kyc', 'pending_payment', 'past_due', 'expired'
  ));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_intended_plan_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_intended_plan_check
  CHECK (intended_plan IS NULL OR intended_plan IN ('free', 'capacity', 'premium'));

-- Kont ki deja egziste: pa bloke yo sou paj plan. Nouvo enskripsyon rete NULL.
UPDATE public.profiles
SET
  plan = COALESCE(plan, 'free'),
  plan_status = CASE
    WHEN plan_status = 'none' OR plan_status IS NULL THEN 'active'
    ELSE plan_status
  END,
  plan_selected_at = COALESCE(plan_selected_at, created_at, now())
WHERE plan IS NULL OR plan_status = 'none';

-- Pa kite kliyan chanje plan yo kont pwòp tèt yo (sèlman service_role / API)
CREATE OR REPLACE FUNCTION public.hatex_protect_plan_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.plan := OLD.plan;
    NEW.plan_status := OLD.plan_status;
    NEW.plan_selected_at := OLD.plan_selected_at;
    NEW.plan_period_end := OLD.plan_period_end;
    NEW.intended_plan := OLD.intended_plan;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hatex_protect_plan_columns ON public.profiles;
CREATE TRIGGER trg_hatex_protect_plan_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.hatex_protect_plan_columns();

-- ============================================================
-- 2. ISTORIK ABONNMAN
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hatex_plan_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('capacity', 'premium')),
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_kyc', 'pending_payment', 'active', 'past_due', 'cancelled', 'expired'
    )),
  amount_htg NUMERIC(14, 2) NOT NULL CHECK (amount_htg > 0),
  payment_id UUID REFERENCES public.hatex_payments(id) ON DELETE SET NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hps_user
  ON public.hatex_plan_subscriptions (user_id, created_at DESC);

ALTER TABLE public.hatex_plan_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hps_owner_select ON public.hatex_plan_subscriptions;
CREATE POLICY hps_owner_select ON public.hatex_plan_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 3. PURPOSE plan_fee
-- ============================================================

ALTER TABLE public.hatex_payments
  DROP CONSTRAINT IF EXISTS hatex_payments_purpose_check;

ALTER TABLE public.hatex_payments
  ADD CONSTRAINT hatex_payments_purpose_check
  CHECK (purpose IN ('merchant', 'kyc_fee', 'crypto_buy', 'invoice', 'plan_fee'));

-- ============================================================
-- 4. PAYOUT: kont plen + 10 jou + istorik tantativ
-- ============================================================

ALTER TABLE public.hatex_payouts
  ADD COLUMN IF NOT EXISTS wallet_full BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hold_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS considered_lost_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_log JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.hatex_payout_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES public.hatex_payouts(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_phone TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'wallet_full')),
  error_message TEXT,
  moncash_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hpa_merchant
  ON public.hatex_payout_attempts (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hpa_payout
  ON public.hatex_payout_attempts (payout_id, created_at DESC);

ALTER TABLE public.hatex_payout_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hpa_merchant_select ON public.hatex_payout_attempts;
CREATE POLICY hpa_merchant_select ON public.hatex_payout_attempts
  FOR SELECT TO authenticated
  USING (merchant_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_hpo_wallet_full
  ON public.hatex_payouts (merchant_id, created_at DESC)
  WHERE wallet_full = true AND status IN ('pending', 'failed');

COMMIT;
