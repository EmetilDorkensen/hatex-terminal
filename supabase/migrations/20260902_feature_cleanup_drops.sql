-- ============================================================================
-- NETWAYAJ DEFINITIF (IRÉVERSIB)
-- ============================================================================
-- Retire totalman (kòd + DB) pou:
--   1) Boutik anliy / Reservations (boutik anliy)
--   2) Terminal POS + QR code
--   3) Gift Cards (Kat kado)
--   4) Kripto / Binance
--
-- Tab yo pa egziste ankò apre migrasyon sa a; done yo PAP janm retounen.
-- Fonksyon RPC ki te sèvi sèlman ak tab sa yo retire tou.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Fonksyon RPC ki sèvi sèlman ak fonksyonalite yo retire yo
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.process_reservation_payment(p_booking_id uuid, p_buyer_id uuid, p_payment_method text);
DROP FUNCTION IF EXISTS public.process_reservation_subscription_renewal(p_subscription_id uuid);

-- Terminal POS / SDK / QR
DROP FUNCTION IF EXISTS public.process_terminal_payment(p_terminal_id uuid, p_card_number text, p_amount numeric);
DROP FUNCTION IF EXISTS public.process_terminal_payment(p_invoice_id uuid, p_card_number text, p_cvv text, p_exp_date text, p_full_name text);
DROP FUNCTION IF EXISTS public.process_sdk_payment(p_terminal_id text, p_card_number text, p_amount numeric, p_order_id text);
DROP FUNCTION IF EXISTS public.process_sdk_payment(p_terminal_id text, p_card_number text, p_amount numeric, p_order_id text, p_otp_code text);
DROP FUNCTION IF EXISTS public.process_sdk_payment(p_terminal_id uuid, p_card_number text, p_amount numeric, p_order_id text, p_otp_code text, p_platform text, p_customer_name text, p_customer_phone text, p_customer_address text, p_product_name text, p_product_image text, p_product_url text, p_quantity integer);
DROP FUNCTION IF EXISTS public.sync_merchant_terminal_earnings(p_merchant_id uuid);

-- ---------------------------------------------------------------------------
-- 2) Tab yo (CASCADE retire constraints/triggers/policies depandan yo)
--    (hatex_binance_events → hatex_crypto_orders; hatex_gift_card_orders → hatex_gift_cards)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.reservation_bookings CASCADE;
DROP TABLE IF EXISTS public.reservation_subscriptions CASCADE;
DROP TABLE IF EXISTS public.reservation_listings CASCADE;
DROP TABLE IF EXISTS public.reservation_merchants CASCADE;

DROP TABLE IF EXISTS public.hatex_gift_card_orders CASCADE;
DROP TABLE IF EXISTS public.hatex_gift_cards CASCADE;

DROP TABLE IF EXISTS public.hatex_binance_events CASCADE;
DROP TABLE IF EXISTS public.hatex_crypto_rates CASCADE;
DROP TABLE IF EXISTS public.hatex_crypto_orders CASCADE;

DROP TABLE IF EXISTS public.terminal_notifications CASCADE;

COMMIT;
