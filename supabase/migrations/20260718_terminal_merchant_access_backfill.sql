-- ============================================================================
-- BACKFILL: Aksè Terminal/Developer pou machann ki deja elijib
-- ============================================================================
-- Anpil itilizatè te gen KYC apwouve + kat men `is_card_activated` pa t mete,
-- oswa yo pa t gen api_key/is_merchant. Sa te fè sèlman kont admin (ki te
-- pwovizyone manyèlman) ka antre nan /developer.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Mete is_card_activated = true pou moun ki peye frè aktivasyon an deja
UPDATE public.profiles p
SET is_card_activated = true
WHERE p.kyc_status = 'approved'
  AND p.is_card_activated IS NOT TRUE
  AND EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.user_id = p.id
      AND t.type = 'CARD_ACTIVATION'
      AND t.status = 'success'
  );

-- 2) Pwovizyone kredansyèl API pou tout machann elijib ki poko gen yo
UPDATE public.profiles
SET
  api_key = 'hx_live_' || encode(gen_random_bytes(24), 'hex'),
  is_merchant = true,
  webhook_secret = COALESCE(
    NULLIF(webhook_secret, ''),
    'whsec_' || encode(gen_random_bytes(24), 'hex')
  )
WHERE kyc_status = 'approved'
  AND is_card_activated = true
  AND (api_key IS NULL OR api_key = '' OR is_merchant IS NOT TRUE OR webhook_secret IS NULL OR webhook_secret = '');
