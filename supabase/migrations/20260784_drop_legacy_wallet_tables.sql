-- ============================================================================
-- HatexCard v2: retire ansyen sistèm wallet/kat/ajan — KENBE depo/retrè
-- ============================================================================
-- Pa manyen: profiles.wallet_balance, deposits, withdrawals, hatex_*,
-- invoices, reservation_*, KYC, staff, admin_audit_log, hatex_gateway_settings
-- ============================================================================

-- Kat, transfè, ajan (PA depo/retrè)
DROP TABLE IF EXISTS public.cards CASCADE;
DROP TABLE IF EXISTS public.transfers CASCADE;
DROP TABLE IF EXISTS public.transfer_fee_tiers CASCADE;
DROP TABLE IF EXISTS public.agent_applications CASCADE;
DROP TABLE IF EXISTS public.agent_recharge_requests CASCADE;
DROP TABLE IF EXISTS public.agent_tiers CASCADE;
DROP TABLE IF EXISTS public.promo_codes CASCADE;
DROP TABLE IF EXISTS public.user_discounts CASCADE;
DROP TABLE IF EXISTS public.enterprise_applications CASCADE;

-- Ansyen kès / pwofi
DROP TABLE IF EXISTS public.business_profit_withdrawals CASCADE;
DROP TABLE IF EXISTS public.business_profit_ledger CASCADE;
DROP TABLE IF EXISTS public.business_profit_account CASCADE;
DROP TABLE IF EXISTS public.platform_treasury CASCADE;

-- Ansyen peman kat (pa hatex_payments)
DROP TABLE IF EXISTS public.checkout_payment_locks CASCADE;
DROP TABLE IF EXISTS public.payment_tokens CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.plugin_transactions CASCADE;
DROP TABLE IF EXISTS public.payment_requests CASCADE;

-- Abònman ansyen + pwodwi
DROP TABLE IF EXISTS public.subscriptions_history CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;

-- Notifikasyon machann ansyen
DROP TABLE IF EXISTS public.merchant_notifications CASCADE;

-- Ansyen reglaj frè/limit
DROP TABLE IF EXISTS public.platform_fee_settings CASCADE;
DROP TABLE IF EXISTS public.platform_limit_settings CASCADE;
DROP TABLE IF EXISTS public.account_fee_overrides CASCADE;

-- OAuth / idempotency ansyen
DROP TABLE IF EXISTS public.oauth_tokens CASCADE;
DROP TABLE IF EXISTS public.api_idempotency_keys CASCADE;

-- Ansyen ledger
DROP TABLE IF EXISTS public.transactions CASCADE;
