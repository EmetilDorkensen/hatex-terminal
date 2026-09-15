-- Retire trigger ansyen ki jenere kat vityèl lè KYC apwouve.
-- Kolòn card_number / cvv / exp_date te retire — trigger sa a kraze apwobasyon KYC.

BEGIN;

DROP TRIGGER IF EXISTS on_kyc_approved ON public.profiles;
DROP FUNCTION IF EXISTS public.process_kyc_approval();

COMMIT;
