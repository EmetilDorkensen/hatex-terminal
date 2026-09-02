-- 20260779_crypto_more_assets_and_withdraw.sql
-- Plis aktif + kolòn pou suivi retrait Binance (achte otomatik)

BEGIN;

ALTER TABLE public.hatex_crypto_orders
  ADD COLUMN IF NOT EXISTS binance_withdraw_id TEXT,
  ADD COLUMN IF NOT EXISTS crypto_sent_at TIMESTAMPTZ;

UPDATE public.hatex_crypto_rates
SET deposit_network = COALESCE(NULLIF(deposit_network, ''), 'TRX')
WHERE asset = 'USDT';

INSERT INTO public.hatex_crypto_rates (
  asset, buy_htg_per_unit, sell_htg_per_unit,
  min_buy_htg, max_buy_htg, min_sell_htg, max_sell_htg,
  deposit_network, is_active
) VALUES
  ('BTC',  9800000.00, 9400000.00, 500, 200000, 500, 200000, 'BTC', true),
  ('ETH',   420000.00,  400000.00, 500, 200000, 500, 200000, 'ETH', true),
  ('BNB',    85000.00,   80000.00, 500, 150000, 500, 150000, 'BSC', true)
ON CONFLICT (asset) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  deposit_network = COALESCE(public.hatex_crypto_rates.deposit_network, EXCLUDED.deposit_network),
  updated_at = now();

COMMIT;
