-- Foto / fichye nan mesaj kontak + bucket prive

BEGIN;

ALTER TABLE public.contact_inbox
  ADD COLUMN IF NOT EXISTS attachment_paths TEXT[] NOT NULL DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contact-attachments',
  'contact-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = false;

-- Pa gen politik storage piblik — sèlman service_role (API) upload / signed URL.

COMMIT;
