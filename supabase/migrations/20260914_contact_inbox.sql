-- Bwat mesaj piblik (support@ / business@ / contact@)
-- Moun ekri atravè fòm /kontakte oswa (talè) webhook imèl inbound.
-- Admin + anplwaye sipò wè yo nan app la — pa bezwen Gmail.

BEGIN;

CREATE TABLE IF NOT EXISTS public.contact_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('support', 'business', 'contact')),
  from_name TEXT,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'answered', 'closed')),
  source TEXT NOT NULL DEFAULT 'web_form'
    CHECK (source IN ('web_form', 'email')),
  external_message_id TEXT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_inbox_status_created
  ON public.contact_inbox (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_inbox_channel
  ON public.contact_inbox (channel, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_inbox_ext_msg
  ON public.contact_inbox (external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.contact_inbox_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id UUID NOT NULL REFERENCES public.contact_inbox(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  emailed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_inbox_replies_inbox
  ON public.contact_inbox_replies (inbox_id, created_at);

ALTER TABLE public.contact_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inbox_replies ENABLE ROW LEVEL SECURITY;

-- Pa gen politik piblik: sèlman service_role (API) li/ekri.
-- Anpeche kliyan anon li inbox la atravè Supabase client.

COMMIT;
