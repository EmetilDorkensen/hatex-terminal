-- Kòd aksè inik (rekiperasyon) — tankou Stripe.
-- Si kliyan an pèdi/efase MFA li, modpas oswa PIN li,
-- li ka konekte ak kòd sa a. Kòd la dire 2 zan, li itilizab yon sèl fwa.
-- Nou sere: HMAC hash (verifikasyon) + vèsyon chifre AES-256-GCM (afichaj nan Paramèt apre MFA).

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS recovery_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS recovery_code_enc TEXT,
  ADD COLUMN IF NOT EXISTS recovery_code_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_code_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_code_used_at TIMESTAMPTZ;

COMMIT;
