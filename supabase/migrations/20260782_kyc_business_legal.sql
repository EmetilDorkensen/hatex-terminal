-- KYC kont biznis: papye legal MonCash mande + 2 pati (WhatsApp / MonCash)
-- + jounal Alert URL MonCash (webhook)

ALTER TABLE public.hatex_kyc_applications
  ADD COLUMN IF NOT EXISTS service_description TEXT,
  ADD COLUMN IF NOT EXISTS business_nif TEXT,
  ADD COLUMN IF NOT EXISTS business_rccm TEXT,
  ADD COLUMN IF NOT EXISTS party1_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS party1_moncash TEXT,
  ADD COLUMN IF NOT EXISTS party2_full_name TEXT,
  ADD COLUMN IF NOT EXISTS party2_role TEXT,
  ADD COLUMN IF NOT EXISTS party2_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS party2_moncash TEXT,
  ADD COLUMN IF NOT EXISTS tax_clearance_path TEXT,
  ADD COLUMN IF NOT EXISTS establishment_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS proof_of_address_path TEXT,
  ADD COLUMN IF NOT EXISTS articles_path TEXT,
  ADD COLUMN IF NOT EXISTS business_nif_doc_path TEXT;

CREATE TABLE IF NOT EXISTS public.hatex_moncash_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_order_id TEXT,
  transaction_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  settled BOOLEAN,
  settle_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hma_created
  ON public.hatex_moncash_alerts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hma_order
  ON public.hatex_moncash_alerts (gateway_order_id)
  WHERE gateway_order_id IS NOT NULL;

ALTER TABLE public.hatex_moncash_alerts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.hatex_moncash_alerts IS
  'Jounal Alert URL MonCash (webhook sèvè-a-sèvè). Règleman an toujou verifye ak RetrieveOrder.';
