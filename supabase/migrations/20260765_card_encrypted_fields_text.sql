-- ============================================================
-- Kat chifre (enc:v1:…) depase varchar(16) ki te fèt pou PAN klè.
-- Elaji card_number / cvv pou AES-GCM ciphertext.
-- Kouri nan Supabase > SQL Editor si migrasyon auto pa apliké.
-- ============================================================

ALTER TABLE public.profiles
  ALTER COLUMN card_number TYPE TEXT USING card_number::TEXT;

ALTER TABLE public.profiles
  ALTER COLUMN cvv TYPE TEXT USING cvv::TEXT;

COMMENT ON COLUMN public.profiles.card_number IS
  'PAN chifre at-rest (enc:v1:AES-GCM). Pa estoke nimewo klè.';
COMMENT ON COLUMN public.profiles.cvv IS
  'CVV chifre at-rest (enc:v1:AES-GCM). Pa estoke CVV klè.';
