-- ============================================================================
-- SISTÈM WEBHOOK MILTI-PWEN POU DEVLOPÈ (estil Stripe/PayPal)
-- ============================================================================
-- Ansyen sistèm nan te gen SÈLMAN yon sèl webhook_url + webhook_secret sou tab
-- `profiles`. Kounye a chak machann ka gen PLIZYÈ pwen webhook, chak ak pwòp
-- secret pa li, chak abòne a evènman espesifik, epi tout delivrans yo
-- anrejistre (pou re-eseye otomatik + istorik nan tablodbò /developer).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Pwen webhook yo (endpoints)
CREATE TABLE IF NOT EXISTS public.developer_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['payment.success']::text[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dwe_merchant ON public.developer_webhook_endpoints (merchant_id);

ALTER TABLE public.developer_webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- Machann nan ka LI pwòp pwen li yo (lekti sèlman via RLS — kreyasyon/efasman
-- pase pa wout API server-side ki itilize service_role epi ki verifye sesyon an).
DROP POLICY IF EXISTS "dwe_owner_select" ON public.developer_webhook_endpoints;
CREATE POLICY "dwe_owner_select" ON public.developer_webhook_endpoints
  FOR SELECT USING (auth.uid() = merchant_id);

-- 2. Jounal delivrans yo
CREATE TABLE IF NOT EXISTS public.developer_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES public.developer_webhook_endpoints(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dwd_merchant ON public.developer_webhook_deliveries (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dwd_retry ON public.developer_webhook_deliveries (next_retry_at) WHERE success = false;

ALTER TABLE public.developer_webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Machann nan ka LI pwòp istorik delivrans li (lekti sèlman).
DROP POLICY IF EXISTS "dwd_owner_select" ON public.developer_webhook_deliveries;
CREATE POLICY "dwd_owner_select" ON public.developer_webhook_deliveries
  FOR SELECT USING (auth.uid() = merchant_id);

-- 3. Backfill: pou chak machann ki gen deja yon webhook_url + webhook_secret
--    sou profiles, kreye yon pwen ekivalan pou pa pèdi konfigirasyon aktyèl la.
INSERT INTO public.developer_webhook_endpoints (merchant_id, url, secret, events, is_active, description)
SELECT p.id, p.webhook_url, p.webhook_secret, ARRAY['payment.success']::text[], true, 'Enpòte otomatikman'
FROM public.profiles p
WHERE p.webhook_url IS NOT NULL
  AND p.webhook_url <> ''
  AND p.webhook_secret IS NOT NULL
  AND p.webhook_secret <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.developer_webhook_endpoints e
    WHERE e.merchant_id = p.id AND e.url = p.webhook_url
  );

COMMENT ON TABLE public.developer_webhook_endpoints IS 'Pwen webhook devlopè yo (milti-pwen). Chak machann ka gen plizyè URL, chak ak secret pa li. Jere pa /api/developer/webhooks.';
COMMENT ON TABLE public.developer_webhook_deliveries IS 'Jounal tantativ delivrans webhook. Re-eseye otomatik via /api/developer/webhooks/process-retries (cron).';
