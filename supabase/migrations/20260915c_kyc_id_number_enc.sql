-- Sere nimewo ID KYC an plen (chifre AES) — sèlman service_role / admin API ka li.
-- Hash + last4 rete pou verifikasyon/dedup; enc la pou asistans wè nimewo a.

BEGIN;

ALTER TABLE public.hatex_kyc_applications
  ADD COLUMN IF NOT EXISTS id_number_enc TEXT;

-- Pa kite kliyan anon/authenticated li kolòn chifre a atravè PostgREST
REVOKE SELECT (id_number_enc) ON public.hatex_kyc_applications FROM authenticated, anon;

COMMIT;
