-- ============================================================================
-- 20260902: Fix prod drift + opaque share tokens for public payment URLs.
--
-- 1) platform_limit_settings te manke sou pwodiksyon pandan hatex_resolve_limit
--    ak trigger yo te deja la -> fok yo apliké ankò (idempotan).
-- 2) hatex_products / invoices jwenn yon share_token opak (32 hex) pou
--    lyen piblik yo pa ekspoze id entèn (uuid) nan URL / e-mail / order refs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. platform_limit_settings (pa janm dwe manke ankò)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_limit_settings (
  limit_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  value NUMERIC NOT NULL CHECK (value >= 0),
  unit TEXT NOT NULL DEFAULT 'htg',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE public.platform_limit_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_limit_settings_admin_select ON public.platform_limit_settings;
CREATE POLICY platform_limit_settings_admin_select ON public.platform_limit_settings
  FOR SELECT USING (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
  );

INSERT INTO public.platform_limit_settings (limit_key, label, value, unit, description) VALUES
  ('individual_daily_limit', 'Limit jounalye endividyèl', 75000, 'htg', 'Depans/retrè/transfè pa jou'),
  ('individual_monthly_limit', 'Limit mansyèl endividyèl', 250000, 'htg', 'Depans/retrè/transfè pa mwa'),
  ('individual_invoice_daily_limit', 'Limit fakti jounalye', 85000, 'htg', 'Total fakti kreye pa jou (endividyèl)'),
  ('individual_max_wallet', 'Plafon wallet endividyèl', 105000, 'htg', 'Balans maksimòm'),
  ('enterprise_max_wallet', 'Plafon wallet antrepriz', 2000000, 'htg', 'Balans maksimòm biznis'),
  ('enterprise_card_daily_limit', 'Limit kat antrepriz / jou', 100000, 'htg', NULL),
  ('enterprise_card_monthly_limit', 'Limit kat antrepriz / mwa', 4800000, 'htg', NULL),
  ('api_receive_individual', 'Limit API resevwa endividyèl', 50000, 'htg', NULL),
  ('api_receive_enterprise', 'Limit API resevwa antrepriz', 2000000, 'htg', NULL),
  ('min_deposit', 'Depo minimòm', 500, 'htg', NULL),
  ('min_withdraw', 'Retrè minimòm', 500, 'htg', NULL),
  ('vip_withdraw_threshold', 'Sèy VIP retrè', 15000, 'htg', 'Retrè MonCash san frè anwo sèy sa a'),
  ('card_recharge_max', 'Rechaj kat maksimòm', 70000, 'htg', NULL),
  ('agent_pro_capacity', 'Kapasite ajan PRO', 55000, 'htg', NULL),
  ('agent_premium_capacity', 'Kapasite ajan PREMIUM', 110000, 'htg', NULL),
  ('agent_withdraw_share_rate', 'Pati frè ajan (retrè)', 0.2, 'rate', '0–1')
ON CONFLICT (limit_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.hatex_resolve_limit(
  p_limit_key TEXT,
  p_default NUMERIC DEFAULT 0
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val NUMERIC;
BEGIN
  SELECT value INTO v_val
  FROM public.platform_limit_settings
  WHERE limit_key = p_limit_key;
  IF v_val IS NULL THEN
    RETURN COALESCE(p_default, 0);
  END IF;
  RETURN v_val;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_resolve_limit(TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hatex_resolve_limit(TEXT, NUMERIC) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Fonksyon token opak (32 hex) + kolòn share_token
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hatex_share_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
AS $$
  SELECT replace(gen_random_uuid()::text, '-', '');
$$;

-- hatex_products
ALTER TABLE public.hatex_products
  ADD COLUMN IF NOT EXISTS share_token TEXT;

ALTER TABLE public.hatex_products
  ALTER COLUMN share_token SET DEFAULT public.hatex_share_token();

UPDATE public.hatex_products
SET share_token = public.hatex_share_token()
WHERE share_token IS NULL OR share_token = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_hatex_products_share_token
  ON public.hatex_products (share_token)
  WHERE share_token IS NOT NULL;

-- invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS share_token TEXT;

ALTER TABLE public.invoices
  ALTER COLUMN share_token SET DEFAULT public.hatex_share_token();

UPDATE public.invoices
SET share_token = public.hatex_share_token()
WHERE share_token IS NULL OR share_token = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_share_token
  ON public.invoices (share_token)
  WHERE share_token IS NOT NULL;
