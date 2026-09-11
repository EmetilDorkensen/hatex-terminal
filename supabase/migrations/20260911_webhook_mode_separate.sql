-- ============================================================================
-- Separe mòd test / live pou webhook (tankou Stripe)
-- ============================================================================
-- Chak pwen webhook gen yon mòd. Peman test → sèlman endpoint test.
-- Peman live → sèlman endpoint live. Pa melanje.
-- ============================================================================

BEGIN;

ALTER TABLE public.developer_webhook_endpoints
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'live'
  CHECK (mode IN ('test', 'live'));

CREATE INDEX IF NOT EXISTS idx_dwe_merchant_mode
  ON public.developer_webhook_endpoints (merchant_id, mode);

COMMENT ON COLUMN public.developer_webhook_endpoints.mode IS
  'test = resevwa sèlman peman sandbox; live = resevwa sèlman vre lajan. Pa melanje.';

COMMIT;
