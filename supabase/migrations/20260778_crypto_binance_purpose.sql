-- 20260778_crypto_binance_purpose.sql
-- Extansyon kripto: purpose crypto_buy + kolòn depo Binance

BEGIN;

ALTER TABLE public.hatex_payments
  DROP CONSTRAINT IF EXISTS hatex_payments_purpose_check;

ALTER TABLE public.hatex_payments
  ADD CONSTRAINT hatex_payments_purpose_check
  CHECK (purpose IN ('merchant', 'kyc_fee', 'crypto_buy'));

COMMENT ON COLUMN public.hatex_payments.purpose IS
  'merchant = peman machann; kyc_fee = frè KYC; crypto_buy = achte kripto (revni HatexCard jiskaske depo kripto fèt)';

ALTER TABLE public.hatex_crypto_rates
  ADD COLUMN IF NOT EXISTS deposit_network TEXT NOT NULL DEFAULT 'TRX';

ALTER TABLE public.hatex_crypto_orders
  ADD COLUMN IF NOT EXISTS deposit_address TEXT,
  ADD COLUMN IF NOT EXISTS deposit_network TEXT,
  ADD COLUMN IF NOT EXISTS deposit_memo TEXT,
  ADD COLUMN IF NOT EXISTS moncash_payout_tx TEXT;

CREATE INDEX IF NOT EXISTS idx_crypto_orders_awaiting_deposit
  ON public.hatex_crypto_orders (asset, status, amount_crypto)
  WHERE status = 'awaiting_deposit';

COMMIT;
