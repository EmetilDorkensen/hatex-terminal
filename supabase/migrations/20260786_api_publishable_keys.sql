-- ============================================================================
-- HATEXCARD — Kle Publishable (estil Stripe pk_)
-- ============================================================================
-- Stripe gen DE kalite kle:
--   • Publishable key (pk_...) — san danje, ka parèt nan frontend/navigatè.
--     Itilize pou checkout kliyan an (QR checkout), janm gen aksè modifikasyon.
--   • Secret key (hx_...) — sèlman sou sèvè, janm ekspoze.
--
-- Nou ajoute estokaj publishable key sou pwofil machann nan (hash + prefix,
-- menm modèl ak secret key la). Kle an klè retounen yon sèl fwa lè kreye/rotate.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS api_key_pk_hash TEXT,
  ADD COLUMN IF NOT EXISTS api_key_pk_prefix TEXT,
  ADD COLUMN IF NOT EXISTS api_key_pk TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_api_key_pk_hash
  ON public.profiles (api_key_pk_hash)
  WHERE api_key_pk_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_api_key_pk_prefix
  ON public.profiles (api_key_pk_prefix)
  WHERE api_key_pk_prefix IS NOT NULL;

COMMENT ON COLUMN public.profiles.api_key_pk_hash IS
  'HMAC-SHA256(API_KEY_HASH_SECRET, pk_...) — publishable key, san danje frontend.';
COMMENT ON COLUMN public.profiles.api_key_pk_prefix IS
  'Premye 12 karaktè publishable key a pou UI (masking).';
