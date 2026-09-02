-- ============================================================================
-- HATEXCARD v2 — KYC PEYE VIA MONCASH + LIVENESS
-- ============================================================================
-- Nouvo flow: moun enskri -> konfime imel -> konekte -> ranpli KYC ->
-- verifye figi (liveness) -> peye 1920 HTG sou MonCash -> dokiman soumèt
-- otomatik -> tann apwobasyon admin.
--
-- Frè a PA soti nan yon wòlèt (pa gen wòlèt nan v2) — li pase sou MonCash.
-- Migrasyon sa a se ADISYON sèlman; li pa touche ansyen KYC v1.
-- ============================================================================

-- ============================================================
-- 1. FRÈ KYC KONFIGIRAB
-- ============================================================

INSERT INTO public.hatex_gateway_settings (key, label, value, unit, description) VALUES
  ('kyc_fee_individual_htg', 'Frè KYC — kont endividyèl', 1920, 'htg',
   'Sa moun peye sou MonCash anvan dosye KYC li soumèt'),
  ('kyc_fee_business_htg',   'Frè KYC — kont biznis',     1920, 'htg',
   'Sa yon biznis peye sou MonCash anvan dosye KYC li soumèt')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. PEMAN ENTÈN (frè KYC) vs PEMAN MACHANN
-- ============================================================
-- Yon peman frè KYC pa gen payout — se revni HatexCard nèt. Kolòn `purpose`
-- la fè règleman an konnen li pa dwe kreye yon liy payout.

ALTER TABLE public.hatex_payments
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'merchant';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hatex_payments_purpose_check'
  ) THEN
    ALTER TABLE public.hatex_payments
      ADD CONSTRAINT hatex_payments_purpose_check
      CHECK (purpose IN ('merchant', 'kyc_fee'));
  END IF;
END $$;

-- Pou yon frè KYC, tout montan an se frè platfòm — machann nan resevwa 0.
-- Ansyen kontrent la te mande merchant_amount > 0.
ALTER TABLE public.hatex_payments
  DROP CONSTRAINT IF EXISTS hatex_payments_merchant_amount_check;
ALTER TABLE public.hatex_payments
  ADD CONSTRAINT hatex_payments_merchant_amount_check
  CHECK (merchant_amount >= 0);

CREATE INDEX IF NOT EXISTS idx_hp_purpose
  ON public.hatex_payments (purpose, status);

-- Vi volim mwa a dwe konte SÈLMAN vre peman machann
CREATE OR REPLACE VIEW public.hatex_merchant_monthly_volume
WITH (security_invoker = on) AS
SELECT
  merchant_id,
  mode,
  date_trunc('month', paid_at) AS month,
  SUM(merchant_amount) AS total_htg,
  COUNT(*) AS payment_count
FROM public.hatex_payments
WHERE status = 'paid'
  AND paid_at IS NOT NULL
  AND purpose = 'merchant'
GROUP BY merchant_id, mode, date_trunc('month', paid_at);

-- ============================================================
-- 3. LIVENESS + DEDIPLIKASYON SOU DOSYE KYC
-- ============================================================

ALTER TABLE public.hatex_kyc_applications
  ADD COLUMN IF NOT EXISTS face_match_score NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS liveness_passed BOOLEAN,
  ADD COLUMN IF NOT EXISTS liveness_frame_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liveness_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS needs_manual_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS id_number_hash TEXT,
  ADD COLUMN IF NOT EXISTS id_number_last4 TEXT,
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS fee_paid_at TIMESTAMPTZ;

-- Menm pyès idantite pa ka sèvi pou de dosye ki apwouve/annatant
CREATE UNIQUE INDEX IF NOT EXISTS idx_hka_unique_id_number
  ON public.hatex_kyc_applications (id_number_hash)
  WHERE id_number_hash IS NOT NULL
    AND status IN ('submitted', 'in_review', 'approved');

CREATE INDEX IF NOT EXISTS idx_hka_user_status
  ON public.hatex_kyc_applications (user_id, status);

-- Chan ki obligatwa sèlman lè dosye a soumèt — pandan `draft` yo ka vid.
-- Ansyen definisyon an te mande yo tout depi kreyasyon an.
ALTER TABLE public.hatex_kyc_applications
  ALTER COLUMN full_name           DROP NOT NULL,
  ALTER COLUMN date_of_birth       DROP NOT NULL,
  ALTER COLUMN address_street      DROP NOT NULL,
  ALTER COLUMN address_city        DROP NOT NULL,
  ALTER COLUMN address_department  DROP NOT NULL,
  ALTER COLUMN phone_primary       DROP NOT NULL,
  ALTER COLUMN email               DROP NOT NULL,
  ALTER COLUMN activity_category   DROP NOT NULL,
  ALTER COLUMN payout_phone        DROP NOT NULL;

-- Yon dosye ki soumèt DWE konplè. Kontrent sa a ranplase NOT NULL yo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hka_submitted_requires_fields'
  ) THEN
    ALTER TABLE public.hatex_kyc_applications
      ADD CONSTRAINT hka_submitted_requires_fields CHECK (
        status = 'draft'
        OR status = 'rejected'
        OR (
          full_name          IS NOT NULL AND
          date_of_birth      IS NOT NULL AND
          address_street     IS NOT NULL AND
          address_city       IS NOT NULL AND
          address_department  IS NOT NULL AND
          phone_primary      IS NOT NULL AND
          email              IS NOT NULL AND
          activity_category  IS NOT NULL AND
          payout_phone       IS NOT NULL AND
          id_front_path      IS NOT NULL AND
          selfie_path        IS NOT NULL AND
          fee_paid           = true
        )
      );
  END IF;
END $$;

-- ============================================================
-- 4. AKSÈ ADMIN SOU DOKIMAN
-- ============================================================
-- Pa gen politik admin sou bucket la espre: revizyon fèt atravè wout API ki
-- sèvi ak service_role epi ki bay URL siyen ki ekspire (menm patèn ak KYC v1).
-- Konsa yon sèl kote kontwole ki moun ka wè dokiman, epi tout aksè trase.

COMMENT ON COLUMN public.hatex_payments.purpose IS
  'merchant = peman kliyan pou yon machann (gen payout); kyc_fee = frè KYC (pa gen payout).';
COMMENT ON COLUMN public.hatex_kyc_applications.liveness_passed IS
  'Rezilta konparezon figi an dirèk ak dokiman idantite a (Face++).';
