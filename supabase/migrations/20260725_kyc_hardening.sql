-- KYC hardening: estati not_submitted, kolòn OCR/figi, bucket prive

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_doc_type TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_id_number_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_face_match_score NUMERIC(5, 2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_kyc_id_hash
  ON profiles(kyc_id_number_hash)
  WHERE kyc_id_number_hash IS NOT NULL;

-- Moun ki "pending" men pa janm voye dokiman → not_submitted
UPDATE profiles
SET kyc_status = 'not_submitted'
WHERE kyc_status = 'pending'
  AND COALESCE(kyc_front, '') = ''
  AND COALESCE(kyc_selfie, '') = '';

-- Bucket KYC prive (pa URL piblik)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "kyc_documents_insert" ON storage.objects;
CREATE POLICY "kyc_documents_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND name LIKE (auth.uid()::text || '/%')
);

DROP POLICY IF EXISTS "kyc_documents_select_own" ON storage.objects;
CREATE POLICY "kyc_documents_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND name LIKE (auth.uid()::text || '/%')
);

DROP POLICY IF EXISTS "kyc_documents_admin_select" ON storage.objects;
CREATE POLICY "kyc_documents_admin_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND lower(auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com'
);
