-- 20260780_invoice_payout_moncash.sql
-- Fakti: kont resepsyon + peman MonCash (purpose invoice)

BEGIN;

-- Kont bank USA kòm kind
ALTER TABLE public.hatex_bank_accounts
  DROP CONSTRAINT IF EXISTS hatex_bank_accounts_kind_check;

ALTER TABLE public.hatex_bank_accounts
  ADD CONSTRAINT hatex_bank_accounts_kind_check
  CHECK (kind IN ('moncash', 'natcash', 'bank', 'bank_us'));

-- Kolòn fakti
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'HTG'
    CHECK (currency IN ('HTG', 'USD')),
  ADD COLUMN IF NOT EXISTS payout_account_id UUID
    REFERENCES public.hatex_bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_id UUID
    REFERENCES public.hatex_payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_total_htg NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS platform_fee_htg NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payout_fee_htg NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS usd_rate_used NUMERIC(12,4);

CREATE INDEX IF NOT EXISTS idx_invoices_payout_account
  ON public.invoices (payout_account_id)
  WHERE payout_account_id IS NOT NULL;

-- Purpose invoice sou hatex_payments
ALTER TABLE public.hatex_payments
  DROP CONSTRAINT IF EXISTS hatex_payments_purpose_check;

ALTER TABLE public.hatex_payments
  ADD CONSTRAINT hatex_payments_purpose_check
  CHECK (purpose IN ('merchant', 'kyc_fee', 'crypto_buy', 'invoice'));

-- To USD (admin ka chanje)
INSERT INTO public.hatex_gateway_settings (key, label, value, unit, description)
VALUES (
  'usd_htg_rate',
  'To USD → HTG',
  132,
  'htg',
  '1 USD = X HTG pou fakti / checkout (admin)'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
