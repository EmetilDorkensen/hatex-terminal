-- ============================================================================
-- HATEXCARD — Ajoute api_key_mode nan profiles
-- ============================================================================
-- Pèmèt machann nan chwazi si kle API li a se 'test' (sandbox MonCash) oswa
-- 'live' (MonCash pwodiksyon). Default se 'live' paske tout kle API aktyèl yo
-- kòmanse ak prefiks hx_live_.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS api_key_mode TEXT NOT NULL DEFAULT 'live'
  CHECK (api_key_mode IN ('test', 'live'));

-- Tout machann ki deja gen yon kle API yo rete nan mòd live (default).
