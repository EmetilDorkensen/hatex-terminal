-- ============================================================================
-- SEKIRITE KLE API: hash HMAC nan baz done (pa tèks klè)
-- ============================================================================
-- Kle konplè (`hx_live_...`) pa rete nan baz done a. Nou kenbe sèlman:
--   - api_key_hash  : HMAC-SHA256 ak API_KEY_HASH_SECRET sou sèvè a
--   - api_key_prefix: premye 12 karaktè pou afichaj (hx_live_abcd)
-- Migrasyon lazy nan aplikasyon an ap konvèti ansyen `api_key` an klè lè yo
-- itilize yo pou premye fwa, epi efase kolòn `api_key` apre sa.
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS api_key_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS api_key_prefix TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_api_key_hash
  ON public.profiles (api_key_hash)
  WHERE api_key_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_api_key_prefix
  ON public.profiles (api_key_prefix)
  WHERE api_key_prefix IS NOT NULL;

COMMENT ON COLUMN public.profiles.api_key_hash IS 'HMAC-SHA256(API_KEY_HASH_SECRET, hx_live_...) — pa janm afiche kle konplè a.';
COMMENT ON COLUMN public.profiles.api_key_prefix IS 'Premye 12 karaktè kle a pou UI (masking).';
