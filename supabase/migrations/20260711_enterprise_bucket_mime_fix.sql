-- ============================================================
-- FIX: Kèk telefòn (esp. iPhone/Android) voye foto nan fòma HEIC/HEIF
-- oswa san yon MIME klè. Bucket 'enterprise_documents' la te
-- konfigire pou aksepte SÈLMAN jpg/png/webp/pdf, kidonk telechajman
-- yo te echwe san yon mesaj klè epi TOUT aplikasyon an te anile
-- (san frè 49,000 HTG pa peye, san dokiman pa parèt nan espas travay).
-- Kouri script sa a nan Supabase SQL Editor.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'enterprise_documents',
  'enterprise_documents',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- NÒT: si w toujou wè yon erè "Bucket not found" apre w kouri script sa a,
-- se paske migrasyon 20260706_enterprise_accounts.sql oswa
-- 20260708_enterprise_documents_bucket.sql poko janm kouri sou baz done
-- pwodiksyon an — kouri de(2) fichye sa yo tou nan SQL Editor la.
--
-- NÒT 2: si w wè yon erè ki di "SUPABASE_SERVICE_ROLE_KEY pa mete nan
-- anviwonman an", ale nan Vercel → Project Settings → Environment
-- Variables epi verifye 'SUPABASE_SERVICE_ROLE_KEY' egziste pou
-- anviwonman "Production" a (se kle sekrè "service_role" ki nan
-- Supabase → Project Settings → API).
