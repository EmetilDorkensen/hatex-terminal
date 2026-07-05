-- ============================================================
-- FIX: BUCKET NOT FOUND — enterprise_documents
-- Kouri script sa a nan Supabase SQL Editor si ou wè erè
-- "Bucket not found" lè w ap peye frè Kont Antrepriz (49,000 HTG).
-- ============================================================

-- 1) Kreye bucket la (oswa mete ajou si li egziste deja)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'enterprise_documents',
  'enterprise_documents',
  true,
  10485760, -- 10 Mo max pa fichye
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Règ aksè Storage (RLS) — pèmèt itilizatè konekte yo upload dokiman yo
DROP POLICY IF EXISTS "enterprise_documents_insert" ON storage.objects;
CREATE POLICY "enterprise_documents_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'enterprise_documents'
  AND (
    name LIKE (auth.uid()::text || '/%')
    OR name LIKE ('enterprise-' || auth.uid()::text || '-%')
  )
);

DROP POLICY IF EXISTS "enterprise_documents_select" ON storage.objects;
CREATE POLICY "enterprise_documents_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'enterprise_documents');

DROP POLICY IF EXISTS "enterprise_documents_update" ON storage.objects;
CREATE POLICY "enterprise_documents_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'enterprise_documents'
  AND (
    name LIKE (auth.uid()::text || '/%')
    OR name LIKE ('enterprise-' || auth.uid()::text || '-%')
  )
)
WITH CHECK (bucket_id = 'enterprise_documents');

DROP POLICY IF EXISTS "enterprise_documents_delete" ON storage.objects;
CREATE POLICY "enterprise_documents_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'enterprise_documents'
  AND (
    name LIKE (auth.uid()::text || '/%')
    OR name LIKE ('enterprise-' || auth.uid()::text || '-%')
  )
);
