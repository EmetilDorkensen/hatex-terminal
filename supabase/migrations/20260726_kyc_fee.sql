-- Frè KYC 1150 HTG (enklizif kat) — peye anvan soumèt dokiman

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_fee_paid BOOLEAN NOT NULL DEFAULT false;

-- Moun ki deja peye aktivasyon kat (520) oswa deja nan flow KYC
UPDATE profiles
SET kyc_fee_paid = true
WHERE is_card_activated = true
   OR kyc_status IN ('pending', 'approved')
   OR EXISTS (
     SELECT 1 FROM transactions t
     WHERE t.user_id = profiles.id
       AND t.type IN ('CARD_ACTIVATION', 'KYC_FEE')
       AND t.status = 'success'
   );
