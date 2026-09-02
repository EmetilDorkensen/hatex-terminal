-- ============================================================================
-- HatexCard v2: menaj ansyen sistèm wallet / kat / ajan / depo
-- ============================================================================
-- profiles, auth.users, invoices, rezervasyon, KYC v2, ak tab pasèl yo RETE.
-- Nou retire sèlman tab ki pa gen wòl nan pasèl peman an.
-- ============================================================================

-- 1. Tab kat, depo, retrè, transfè, ajan
DROP TABLE IF EXISTS public.cards CASCADE;
DROP TABLE IF EXISTS public.deposits CASCADE;
DROP TABLE IF EXISTS public.withdrawals CASCADE;
DROP TABLE IF EXISTS public.transfers CASCADE;
DROP TABLE IF EXISTS public.transfer_fee_tiers CASCADE;
DROP TABLE IF EXISTS public.agent_applications CASCADE;
DROP TABLE IF EXISTS public.agent_recharge_requests CASCADE;
DROP TABLE IF EXISTS public.agent_tiers CASCADE;
DROP TABLE IF EXISTS public.user_discounts CASCADE;

-- 2. Ansyen kès / pwofi ki te chita sou wallet
DROP TABLE IF EXISTS public.business_profit_withdrawals CASCADE;
DROP TABLE IF EXISTS public.business_profit_ledger CASCADE;
DROP TABLE IF EXISTS public.business_profit_account CASCADE;
DROP TABLE IF EXISTS public.platform_treasury CASCADE;

-- 3. Peman kat (pa MonCash)
DROP TABLE IF EXISTS public.checkout_payment_locks CASCADE;
DROP TABLE IF EXISTS public.payment_tokens CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;

-- profiles rete entak (id, email, kyc_status, ...). Kolòn wallet/card yo
-- pa efase pou pa kraze pwofil ki egziste — yo jis pa parèt nan UI a.
