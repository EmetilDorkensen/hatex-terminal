-- ============================================================
-- HATExCARD — Sekirite: Hash PIN, Kat, Rate Limit, Lockout
-- Kouri script sa a nan Supabase SQL Editor
-- ============================================================

-- 1. Nouvo kolòn sou profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_code_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS transaction_pin_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS card_number_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cvv_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS card_last4 TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_card_number_hash ON profiles(card_number_hash);
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles((lower(email)));

-- 2. Tab rate limiting (fallback san Upstash)
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at);

-- 3. Fonksyon netwayaj rate_limits (opsyonèl — kouri nan cron)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM rate_limits WHERE reset_at < NOW();
END;
$$;

-- 4. RLS pou rate_limits — sèlman service role
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only rate_limits" ON rate_limits;
CREATE POLICY "Service role only rate_limits"
  ON rate_limits
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- ENPÒTAN: Apre migrasyon
-- - PIN yo ap hash otomatikman lè itilizatè yo konekte/mete PIN
-- - Kat yo ap hash otomatikman lè yo fè premye peman ak kat la
-- - Mete CARD_HASH_SECRET nan Vercel env (32+ karaktè alèatoire)
-- - Mete ADMIN_GATE_PASSWORD nan Vercel env
-- - Mete TELEGRAM_ADMIN_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID
-- - Mete TELEGRAM_FINANCE_BOT_TOKEN, TELEGRAM_FINANCE_CHAT_ID
-- ============================================================

-- 5. (Opsyonèl) Retire kolòn klè yo APRE tout itilizatè yo migrate:
-- ALTER TABLE profiles DROP COLUMN IF EXISTS pin_code;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS transaction_pin;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS cvv;
