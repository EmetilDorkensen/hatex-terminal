-- Imèl ki ka konekte menm lè paj koneksyon an fèmen
-- (anplis adminhatexcard@gmail.com ki toujou otorize).

BEGIN;

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS login_bypass_emails text[] NOT NULL DEFAULT '{}';

COMMIT;
