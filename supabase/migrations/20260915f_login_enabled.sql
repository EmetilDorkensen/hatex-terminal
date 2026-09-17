-- Kontwòl ouvri/femen paj koneksyon (antretyen sit).
-- Admin ka toujou konekte menm lè li fèmen.

BEGIN;

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS login_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS login_closed_message text;

UPDATE public.global_settings
SET login_closed_message = COALESCE(
  NULLIF(TRIM(login_closed_message), ''),
  'Paj koneksyon an fèmen tanporèman. Nou ap travay sou sit la. Eseye ankò pita.'
)
WHERE id = 1;

COMMIT;
