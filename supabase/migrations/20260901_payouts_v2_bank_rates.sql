-- 20260901_payouts_v2_bank_rates.sql
--
-- Payout v2 pou bank (HTG ak USD / Stripe Connect tès):
--   • hatex_payouts          : currency, amount_usd, rate_used, bank_account_id,
--                             provider_transaction_id, confirmed_by/at, manual_note
--   • hatex_bank_accounts    : routing_number, stripe_connect_account_id,
--                             stripe_external_account_id
--   • hatex_gateway_settings : payout_usd_htg_rate (default 132) — admin ka chanje
--                             li nan paj Frè (gwoup "Konvèsyon")
--
-- Retrospektif: routing_number soti nan account_number pou kont bank_us ki te
-- anrejistre kòm "RRRRRRRRR + account" nan yon sèl jaden.

BEGIN;

-- ============================================================
-- 1. hatex_payouts : kolòn payout bank / USD / konfimasyon admin
-- ============================================================

ALTER TABLE public.hatex_payouts
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'HTG'
    CHECK (currency IN ('HTG', 'USD')),
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS rate_used NUMERIC(14, 6),
  ADD COLUMN IF NOT EXISTS bank_account_id UUID
    REFERENCES public.hatex_bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manual_note TEXT;

-- Lapo admin payout (ke /processing), + rekipere pa kont bank
CREATE INDEX IF NOT EXISTS idx_hpo_admin_queue
  ON public.hatex_payouts (created_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_hpo_bank_account
  ON public.hatex_payouts (bank_account_id)
  WHERE bank_account_id IS NOT NULL;

-- ============================================================
-- 2. hatex_bank_accounts : routing + Stripe Connect (tès)
-- ============================================================

ALTER TABLE public.hatex_bank_accounts
  ADD COLUMN IF NOT EXISTS routing_number TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_external_account_id TEXT;

-- Backfill best-effort: "RRRRRRRRR account" → routing = 9 premye chif
UPDATE public.hatex_bank_accounts
SET routing_number = LEFT(REGEXP_REPLACE(account_number, '[^0-9]', '', 'g'), 9)
WHERE kind = 'bank_us'
  AND routing_number IS NULL
  AND REGEXP_REPLACE(account_number, '[^0-9]', '', 'g') ~ '^[0-9]{9}';

-- ============================================================
-- 3. To konvèsyon payout (1 USD = X HTG) — admin ka chanje l
-- ============================================================

INSERT INTO public.hatex_gateway_settings (key, label, value, unit, description)
VALUES (
  'payout_usd_htg_rate',
  '1 USD → HTG (payout bank)',
  132,
  'htg',
  'To konvèsyon pou payout bank USA: 1 USD = X HTG. Chak payout bank_US konvèti an USD lè l kreye.'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
