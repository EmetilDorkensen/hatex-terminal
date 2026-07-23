-- ============================================================================
-- KYC survey: email maten + repons + reply staff
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kyc_survey_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resend_id TEXT,
  email_to TEXT
);

CREATE INDEX IF NOT EXISTS idx_kyc_survey_sends_user_sent
  ON public.kyc_survey_sends (user_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.kyc_survey_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_survey_tokens_user
  ON public.kyc_survey_tokens (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.kyc_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  free_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  staff_replied_at TIMESTAMPTZ,
  staff_reply_preview TEXT,
  staff_replied_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_kyc_survey_responses_created
  ON public.kyc_survey_responses (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kyc_survey_responses_user
  ON public.kyc_survey_responses (user_id, created_at DESC);

ALTER TABLE public.kyc_survey_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_survey_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_survey_responses ENABLE ROW LEVEL SECURITY;

-- Pa gen politik piblik — sèlman service_role (API / cron)
REVOKE ALL ON public.kyc_survey_sends FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.kyc_survey_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.kyc_survey_responses FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.kyc_survey_sends TO service_role;
GRANT ALL ON public.kyc_survey_tokens TO service_role;
GRANT ALL ON public.kyc_survey_responses TO service_role;

COMMENT ON TABLE public.kyc_survey_sends IS 'Istorik email kesyonman KYC (cron 24h)';
COMMENT ON TABLE public.kyc_survey_tokens IS 'Token sekirize pou fòm /kyc-feedback';
COMMENT ON TABLE public.kyc_survey_responses IS 'Repons kliyan sou blokaj KYC';
