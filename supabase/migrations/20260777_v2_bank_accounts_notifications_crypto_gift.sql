-- 20260777_v2_bank_accounts_notifications_crypto_gift.sql
--
-- V2 gateway ekstansyon:
--   • hatex_bank_accounts     : kote payout ale (MonCash, Natcash, kont bank)
--   • hatex_notifications     : notifikasyon nan-app (klòch dashboard la)
--   • hatex_gift_cards        : katalog + kòd kat kado
--   • hatex_gift_card_orders  : achte kat kado via peman MonCash
--   • hatex_crypto_orders     : achte/vann kripto (MonCash ↔ Binance)
--   • hatex_crypto_rates      : to admin mete
--   • hatex_binance_events    : depo kripto ke Binance konfime (webhook)
--
-- Retire ansyen frè aktivasyon 525 HTG (terminal / kat)
--
-- Tout tab yo genyen RLS. Chak moun li pwòp bagay li sèlman;
-- service_role (admin) genyen aksè konplè.

BEGIN;

-- ============================================================
-- 1) hatex_bank_accounts : payout targets pou machann yo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hatex_bank_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('moncash','natcash','bank')),
  label          TEXT NOT NULL DEFAULT '',
  -- MonCash / Natcash
  phone          TEXT,
  -- Bank tradisyonèl
  bank_name      TEXT,
  account_name   TEXT,
  account_number TEXT,
  swift_code     TEXT,
  branch         TEXT,
  is_default     BOOLEAN NOT NULL DEFAULT false,
  is_verified    BOOLEAN NOT NULL DEFAULT false,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user
  ON public.hatex_bank_accounts (user_id, kind);

-- Yon sèl default pa kind pa user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bank_accounts_default
  ON public.hatex_bank_accounts (user_id, kind)
  WHERE is_default = true;

ALTER TABLE public.hatex_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bank_accounts_owner_all ON public.hatex_bank_accounts;
CREATE POLICY bank_accounts_owner_all ON public.hatex_bank_accounts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 2) hatex_notifications : notifikasyon klòch la
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hatex_notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'info',
  title      TEXT NOT NULL,
  body       TEXT,
  href       TEXT,
  read_at    TIMESTAMPTZ,
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.hatex_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.hatex_notifications (user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.hatex_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_owner_read ON public.hatex_notifications;
CREATE POLICY notif_owner_read ON public.hatex_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notif_owner_update ON public.hatex_notifications;
CREATE POLICY notif_owner_update ON public.hatex_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Sèlman service_role ka kreye notifikasyon (sèvè-a-sèvè)

-- ============================================================
-- 3) hatex_gift_cards : katalog admin ap kenbe
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hatex_gift_cards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand        TEXT NOT NULL,
  denomination_htg NUMERIC(12,2) NOT NULL CHECK (denomination_htg > 0),
  denomination_usd NUMERIC(12,2),
  logo_url     TEXT,
  region       TEXT NOT NULL DEFAULT 'global',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  stock_count  INT NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_cards_active
  ON public.hatex_gift_cards (is_active, brand);

ALTER TABLE public.hatex_gift_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gift_cards_public_read ON public.hatex_gift_cards;
CREATE POLICY gift_cards_public_read ON public.hatex_gift_cards
  FOR SELECT TO authenticated
  USING (is_active = true);

-- ============================================================
-- 4) hatex_gift_card_orders : lè yon kliyan achte
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hatex_gift_card_orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gift_card_id UUID REFERENCES public.hatex_gift_cards(id) ON DELETE SET NULL,
  payment_id   UUID REFERENCES public.hatex_payments(id) ON DELETE SET NULL,
  brand        TEXT NOT NULL,
  amount_htg   NUMERIC(12,2) NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','delivered','failed','refunded')),
  code_ciphertext TEXT,  -- kod la se admin ki jere l apre peman
  delivered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_orders_user
  ON public.hatex_gift_card_orders (user_id, created_at DESC);

ALTER TABLE public.hatex_gift_card_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gift_orders_owner_read ON public.hatex_gift_card_orders;
CREATE POLICY gift_orders_owner_read ON public.hatex_gift_card_orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 5) hatex_crypto_rates : to admin fikse
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hatex_crypto_rates (
  asset       TEXT PRIMARY KEY,       -- 'USDT','BTC','ETH','BNB',...
  buy_htg_per_unit  NUMERIC(20,8) NOT NULL,  -- prix machann vann bay kliyan (kliyan ap achte kripto)
  sell_htg_per_unit NUMERIC(20,8) NOT NULL,  -- prix machann peye kliyan (kliyan ap vann kripto)
  min_buy_htg   NUMERIC(12,2) NOT NULL DEFAULT 100,
  max_buy_htg   NUMERIC(12,2) NOT NULL DEFAULT 50000,
  min_sell_htg  NUMERIC(12,2) NOT NULL DEFAULT 100,
  max_sell_htg  NUMERIC(12,2) NOT NULL DEFAULT 50000,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hatex_crypto_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crypto_rates_public_read ON public.hatex_crypto_rates;
CREATE POLICY crypto_rates_public_read ON public.hatex_crypto_rates
  FOR SELECT TO authenticated
  USING (is_active = true);

INSERT INTO public.hatex_crypto_rates (asset, buy_htg_per_unit, sell_htg_per_unit)
VALUES
  ('USDT', 140.00, 130.00)
ON CONFLICT (asset) DO NOTHING;

-- ============================================================
-- 6) hatex_crypto_orders : achte / vann kripto
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hatex_crypto_orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  side         TEXT NOT NULL CHECK (side IN ('buy','sell')),
  asset        TEXT NOT NULL,
  amount_htg   NUMERIC(12,2) NOT NULL CHECK (amount_htg > 0),
  amount_crypto NUMERIC(30,10) NOT NULL,
  rate_used    NUMERIC(20,8) NOT NULL,

  -- Achte: kote nou dwe voye kripto a (adrès Binance kliyan an)
  destination_address TEXT,
  destination_network TEXT,
  destination_memo    TEXT,

  -- Vann: kote nou dwe voye MonCash lè Binance konfime
  payout_kind    TEXT CHECK (payout_kind IN ('moncash','natcash','bank')),
  payout_phone   TEXT,
  bank_account_id UUID REFERENCES public.hatex_bank_accounts(id) ON DELETE SET NULL,

  -- Depo kripto Binance dwe konfime pou vann
  binance_deposit_id TEXT,
  binance_confirmed_at TIMESTAMPTZ,

  -- Peman MonCash (achte)
  payment_id   UUID REFERENCES public.hatex_payments(id) ON DELETE SET NULL,

  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','awaiting_payment','awaiting_deposit','processing','completed','failed','cancelled','expired')),
  status_reason TEXT,
  expires_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crypto_orders_user
  ON public.hatex_crypto_orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crypto_orders_binance_dep
  ON public.hatex_crypto_orders (binance_deposit_id)
  WHERE binance_deposit_id IS NOT NULL;

ALTER TABLE public.hatex_crypto_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crypto_orders_owner_read ON public.hatex_crypto_orders;
CREATE POLICY crypto_orders_owner_read ON public.hatex_crypto_orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Sèlman sèvè-a-sèvè kreye / mete ajou

-- ============================================================
-- 7) hatex_binance_events : mesaj Binance ki rive
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hatex_binance_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      TEXT UNIQUE,             -- pou pa trete de fwa
  order_id      UUID REFERENCES public.hatex_crypto_orders(id) ON DELETE SET NULL,
  asset         TEXT NOT NULL,
  amount        NUMERIC(30,10) NOT NULL,
  tx_hash       TEXT,
  network       TEXT,
  raw           JSONB NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_binance_events_order
  ON public.hatex_binance_events (order_id);

ALTER TABLE public.hatex_binance_events ENABLE ROW LEVEL SECURITY;

-- Sèlman service_role ka li — pa mete okenn RLS pou authenticated

-- ============================================================
-- 8) Retire ansyen frè aktivasyon 525 HTG (kat / terminal)
-- ============================================================
UPDATE public.hatex_gateway_settings
SET value = 0, updated_at = now()
WHERE key IN ('card_activation_fee_htg','features_unlock_fee_htg');

-- Fè kolòn `features_unlock_paid` toujou tounen `true` pou kliyan KYC-apwouve
-- (pou pa kite ansyen kòd bloke terminal / fakti)
UPDATE public.profiles
SET features_unlock_paid = true,
    is_card_activated    = COALESCE(is_card_activated, true)
WHERE kyc_status = 'approved'
  AND (COALESCE(features_unlock_paid, false) = false
       OR COALESCE(is_card_activated, false) = false);

COMMIT;
