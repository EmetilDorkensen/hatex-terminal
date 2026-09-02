-- ============================================================================
-- HATEXCARD v2 — PASRÈL PEMAN (MonCash kòm bank)
-- ============================================================================
-- Nouvo modèl: HatexCard PA kenbe lajan kliyan. Tout peman pase sou kont
-- machann MonCash HatexCard la, epi yon payout otomatik voye montan net la
-- sou nimewo MonCash machann nan.
--
-- Migrasyon sa a se ADISYON sèlman — li pa touche okenn ansyen tab.
-- Kliyan ki enskri deja yo pa pèdi anyen (auth.users + profiles rete entak).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. KONFIGIRASYON PASRÈL (frè, limit) — admin ka chanje san redeploy
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hatex_gateway_settings (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  value NUMERIC(14, 4) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'htg' CHECK (unit IN ('htg', 'percent', 'count')),
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.hatex_gateway_settings (key, label, value, unit, description) VALUES
  ('platform_fee_percent',   'Frè HatexCard (%)',              2,      'percent', 'Pousantaj nou pran sou chak peman — kliyan an peye l anplis'),
  ('platform_fee_min_htg',   'Frè HatexCard minimòm',          0,      'htg',     'Frè minimòm pa tranzaksyon (0 = pa gen minimòm)'),
  ('payout_fee_percent',     'Estimasyon frè transfè MonCash', 1,      'percent', 'Sa MonCash pran lè nou voye payout la'),
  ('payout_fee_min_htg',     'Frè transfè minimòm',            5,      'htg',     'Frè transfè minimòm pa payout'),
  ('max_amount_per_tx_htg',  'Maksimòm pa tranzaksyon',        100000, 'htg',     'Pla-fon pou yon sèl peman'),
  ('min_amount_per_tx_htg',  'Minimòm pa tranzaksyon',         10,     'htg',     'Montan pi piti yon peman ka genyen'),
  ('limit_individual_month_htg', 'Limit mwa — kont endividyèl', 250000, 'htg',    'Total maksimòm yon kont endividyèl ka resevwa pa mwa'),
  ('limit_business_month_htg',   'Limit mwa — kont biznis',    2000000, 'htg',    'Total maksimòm yon kont biznis ka resevwa pa mwa'),
  ('payment_link_ttl_minutes',   'Ekspirasyon lyen peman',      15,    'count',   'Konbyen minit yon lyen peman rete valab')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.hatex_gateway_settings ENABLE ROW LEVEL SECURITY;
-- Pa gen politik: sèlman service_role (wout API sèvè) ka li/ekri.

-- ============================================================
-- 2. KONT MACHANN (konfigirasyon payout + tip kont + limit)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hatex_merchant_accounts (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  account_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (account_type IN ('individual', 'business')),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),

  -- Kote nou voye lajan an
  payout_provider TEXT NOT NULL DEFAULT 'moncash'
    CHECK (payout_provider IN ('moncash', 'natcash')),
  payout_phone TEXT,

  -- Bank lokal (opsyonèl, pou gwo virman manyèl)
  bank_name TEXT,
  bank_account_htg TEXT,

  -- Profil aktivite
  display_name TEXT,
  activity_category TEXT,
  business_url TEXT,
  monthly_volume_estimate NUMERIC(14, 2),

  -- Limit espesifik (NULL = sèvi ak limit global selon tip kont)
  per_tx_limit_htg NUMERIC(14, 2),
  monthly_limit_htg NUMERIC(14, 2),

  -- Payout otomatik aktive?
  auto_payout_enabled BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hma_status ON public.hatex_merchant_accounts (status);

ALTER TABLE public.hatex_merchant_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hma_owner_select ON public.hatex_merchant_accounts;
CREATE POLICY hma_owner_select ON public.hatex_merchant_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 3. KLE API (tès + live pa machann)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hatex_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  label TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

-- Yon sèl kle aktif pa mòd pa machann
CREATE UNIQUE INDEX IF NOT EXISTS idx_hak_one_active_per_mode
  ON public.hatex_api_keys (merchant_id, mode)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_hak_merchant ON public.hatex_api_keys (merchant_id);

ALTER TABLE public.hatex_api_keys ENABLE ROW LEVEL SECURITY;

-- Machann nan ka wè metadone kle li (JAMÈ hash la — se wout API ki filtre kolòn yo)
DROP POLICY IF EXISTS hak_owner_select ON public.hatex_api_keys;
CREATE POLICY hak_owner_select ON public.hatex_api_keys
  FOR SELECT TO authenticated
  USING (merchant_id = auth.uid());

-- ============================================================
-- 4. PEMAN
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hatex_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.hatex_api_keys(id) ON DELETE SET NULL,

  mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),

  -- Referans machann nan bay (kòmand sou sit li)
  merchant_order_id TEXT NOT NULL,
  -- Referans nou voye bay MonCash (inik globalman)
  gateway_order_id TEXT NOT NULL UNIQUE,

  -- Montan (tout an HTG, antye paske MonCash mande antye)
  merchant_amount NUMERIC(14, 2) NOT NULL CHECK (merchant_amount > 0),
  platform_fee NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
  payout_fee NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (payout_fee >= 0),
  client_total NUMERIC(14, 2) NOT NULL CHECK (client_total > 0),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'cancelled')),

  -- Done MonCash
  moncash_token TEXT,
  moncash_transaction_id TEXT,
  payer_phone TEXT,
  moncash_raw JSONB,

  -- Kote nou voye kliyan an apre
  return_url TEXT,
  description TEXT,
  metadata JSONB,

  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotans: yon sèl peman pa (machann, kòmand, mòd)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hp_merchant_order
  ON public.hatex_payments (merchant_id, merchant_order_id, mode);

CREATE INDEX IF NOT EXISTS idx_hp_merchant_created
  ON public.hatex_payments (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hp_status ON public.hatex_payments (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hp_moncash_tx
  ON public.hatex_payments (moncash_transaction_id)
  WHERE moncash_transaction_id IS NOT NULL;

ALTER TABLE public.hatex_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hp_merchant_select ON public.hatex_payments;
CREATE POLICY hp_merchant_select ON public.hatex_payments
  FOR SELECT TO authenticated
  USING (merchant_id = auth.uid());

-- ============================================================
-- 5. PAYOUT (voye lajan bay machann sou MonCash li)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hatex_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES public.hatex_payments(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),

  receiver_provider TEXT NOT NULL DEFAULT 'moncash',
  receiver_phone TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'skipped')),

  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,

  moncash_transaction_id TEXT,
  moncash_raw JSONB,

  reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hpo_merchant ON public.hatex_payouts (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hpo_retry
  ON public.hatex_payouts (next_retry_at)
  WHERE status IN ('pending', 'failed');

ALTER TABLE public.hatex_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hpo_merchant_select ON public.hatex_payouts;
CREATE POLICY hpo_merchant_select ON public.hatex_payouts
  FOR SELECT TO authenticated
  USING (merchant_id = auth.uid());

-- ============================================================
-- 6. KYC v2 (estil Stripe — tip kont + dokiman + liveness)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hatex_kyc_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  account_type TEXT NOT NULL CHECK (account_type IN ('individual', 'business')),

  -- 1. Enfòmasyon pèsonèl
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  address_street TEXT NOT NULL,
  address_city TEXT NOT NULL,
  address_department TEXT NOT NULL,
  phone_primary TEXT NOT NULL,
  email TEXT NOT NULL,

  -- 2. Profil aktivite
  activity_category TEXT NOT NULL,
  monthly_volume_estimate NUMERIC(14, 2),
  business_name TEXT,
  business_url TEXT,

  -- 3. Dokiman (chemen nan storage, pa URL piblik)
  id_document_type TEXT CHECK (id_document_type IN ('cin', 'nif', 'passport', 'driver_license')),
  id_front_path TEXT,
  id_back_path TEXT,
  selfie_path TEXT,
  business_registration_path TEXT,

  -- 4. Detay payout
  payout_provider TEXT NOT NULL DEFAULT 'moncash'
    CHECK (payout_provider IN ('moncash', 'natcash')),
  payout_phone TEXT NOT NULL,
  bank_name TEXT,
  bank_account_htg TEXT,

  -- Revizyon
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'in_review', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,

  fee_paid BOOLEAN NOT NULL DEFAULT false,
  fee_payment_id UUID REFERENCES public.hatex_payments(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Yon sèl dosye an kou pa moun
CREATE UNIQUE INDEX IF NOT EXISTS idx_hka_one_open_per_user
  ON public.hatex_kyc_applications (user_id)
  WHERE status IN ('draft', 'submitted', 'in_review');

CREATE INDEX IF NOT EXISTS idx_hka_status ON public.hatex_kyc_applications (status, created_at DESC);

ALTER TABLE public.hatex_kyc_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hka_owner_select ON public.hatex_kyc_applications;
CREATE POLICY hka_owner_select ON public.hatex_kyc_applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 7. STORAGE — dokiman KYC (PRIVE, pa piblik)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents-v2',
  'kyc-documents-v2',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Moun ka mete pwòp dokiman li sèlman nan pwòp dosye li
DROP POLICY IF EXISTS kyc_v2_insert_own ON storage.objects;
CREATE POLICY kyc_v2_insert_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents-v2'
  AND name LIKE (auth.uid()::text || '/%')
);

DROP POLICY IF EXISTS kyc_v2_select_own ON storage.objects;
CREATE POLICY kyc_v2_select_own
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents-v2'
  AND name LIKE (auth.uid()::text || '/%')
);

-- ============================================================
-- 8. VI: total machann resevwa pa mwa (pou verifye limit)
-- ============================================================

-- security_invoker: vi a respekte RLS moun k ap fè rekèt la, konsa yon machann
-- pa ka wè volim yon lòt machann. San li, vi a ta kouri kòm pwopriyetè a.
CREATE OR REPLACE VIEW public.hatex_merchant_monthly_volume
WITH (security_invoker = on) AS
SELECT
  merchant_id,
  mode,
  date_trunc('month', paid_at) AS month,
  SUM(merchant_amount) AS total_htg,
  COUNT(*) AS payment_count
FROM public.hatex_payments
WHERE status = 'paid' AND paid_at IS NOT NULL
GROUP BY merchant_id, mode, date_trunc('month', paid_at);

COMMENT ON TABLE public.hatex_payments IS
  'Peman v2 — HatexCard pa kenbe lajan; MonCash se depozitè a.';
COMMENT ON TABLE public.hatex_payouts IS
  'Payout otomatik: voye montan net bay machann sou nimewo MonCash li.';
