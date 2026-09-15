-- Rekiperasyon kont ak dokiman KYC (tankou Stripe).
-- Kliyan ki pèdi MFA + kòd aksè soumèt pyès idantite + foto live.
-- Asistans verifye, konpare ak KYC sou dosye, epi klike "Reset MFA"
-- → kliyan resevwa yon lyen inik (1 èdtan, yon sèl fwa) pou re-konfigire MFA.
-- Tout dokiman nan bucket prive; token an sere kòm HMAC hash — pa janm an klè.

BEGIN;

CREATE TABLE IF NOT EXISTS public.account_recovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  id_front_path TEXT,
  id_back_path TEXT,
  selfie_path TEXT,
  client_note TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  reset_token_hash TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  reset_token_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_requests_email
  ON public.account_recovery_requests (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_status
  ON public.account_recovery_requests (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recovery_requests_token
  ON public.account_recovery_requests (reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;

ALTER TABLE public.account_recovery_requests ENABLE ROW LEVEL SECURITY;
-- Pa gen politik piblik: sèlman service_role (API) li/ekri.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recovery-documents',
  'recovery-documents',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = false;

COMMIT;
