-- ============================================================================
-- BACKFILL: is_merchant + webhook_secret pou machann ki gen api_key deja
-- ============================================================================
-- Odit API devlopè a te jwenn ke `is_merchant` pa te janm mete `true`
-- otomatikman lè yon `api_key` te jenere nan app/terminal/page.tsx, e
-- `webhook_secret` pa t janm jenere ditou. Sa te vle di:
--   1. Machann ki te fin apwouve KYC yo pa t ka aksede /developer (ki egzije
--      `is_merchant = true`) menm si yo te gen yon api_key valid.
--   2. Siyati HMAC webhook yo (dokimante nan /developer/docs) pa t ka janm
--      fonksyone paske pa t gen okenn `webhook_secret` anrejistre.
--
-- Migrasyon sa a:
--   1. Asire kolòn yo egziste (si yo te kreye manyèlman anvan, sa pa fè anyen).
--   2. "Backfill" tout pwofil ki gen yon `api_key` deja men ki manke
--      `is_merchant` oswa `webhook_secret`.
-- Kòd aplikasyon an (app/terminal/page.tsx) kounye a jenere tou de valè yo
-- an menm tan pou nouvo machann yo, kidonk migrasyon sa a se sèlman pou
-- "netwaye" done ki te kreye anvan fiks la.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_merchant BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Aktive is_merchant pou tout moun ki gen yon api_key men ki pa marke kòm machann
UPDATE profiles
SET is_merchant = true
WHERE api_key IS NOT NULL
  AND api_key <> ''
  AND (is_merchant IS DISTINCT FROM true);

-- Jenere yon webhook_secret sekirize pou machann ki gen api_key men ki
-- manke yon webhook_secret (itilize pgcrypto ki deja aktive nan pwojè a)
UPDATE profiles
SET webhook_secret = 'whsec_' || encode(gen_random_bytes(24), 'hex')
WHERE api_key IS NOT NULL
  AND api_key <> ''
  AND (webhook_secret IS NULL OR webhook_secret = '');
