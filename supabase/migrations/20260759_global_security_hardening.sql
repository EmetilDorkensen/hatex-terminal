-- ============================================================================
-- Global security hardening:
-- 1) Clear plaintext PIN leftovers
-- 2) Lock enterprise_applications + invoices RLS; private enterprise_documents
-- 3) Narrow staff write policies on transactions/deposits
-- 4) platform_limit_settings + hatex_resolve_limit
-- 5) transfer_fee_tiers + agent_tiers
-- 6) create_deposit_request; admin_approve_deposit recomputes fee
-- 7) process_card_recharge max; invoice daily limit trigger
-- 8) process_kyc_fee + process_plugin_refund atomic RPCs
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Clear legacy plaintext PINs (hashes remain)
-- --------------------------------------------------------------------------
UPDATE public.profiles
SET pin_code = NULL,
    transaction_pin = NULL
WHERE pin_code IS NOT NULL OR transaction_pin IS NOT NULL;

-- --------------------------------------------------------------------------
-- 2. enterprise_applications RLS — own row + admin/staff
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "enterprise_applications_select" ON public.enterprise_applications;
DROP POLICY IF EXISTS "enterprise_applications_insert" ON public.enterprise_applications;
DROP POLICY IF EXISTS "enterprise_applications_update" ON public.enterprise_applications;

CREATE POLICY enterprise_applications_select_own ON public.enterprise_applications
  FOR SELECT USING (
    auth.uid() = user_id
    OR lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(COALESCE(auth.jwt() ->> 'email', ''))
        AND s.status = 'active'
    )
  );

CREATE POLICY enterprise_applications_insert_own ON public.enterprise_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY enterprise_applications_update_own ON public.enterprise_applications
  FOR UPDATE USING (
    auth.uid() = user_id
    OR lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(COALESCE(auth.jwt() ->> 'email', ''))
        AND s.status = 'active'
    )
  );

-- --------------------------------------------------------------------------
-- 3. enterprise_documents bucket private
-- --------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id = 'enterprise_documents';

DROP POLICY IF EXISTS "enterprise_documents_public_select" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "enterprise_documents_select" ON storage.objects;
CREATE POLICY "enterprise_documents_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'enterprise_documents'
  AND (
    name LIKE (auth.uid()::text || '/%')
    OR name LIKE ('enterprise-' || auth.uid()::text || '-%')
    OR lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(COALESCE(auth.jwt() ->> 'email', ''))
        AND s.status = 'active'
    )
  )
);

-- --------------------------------------------------------------------------
-- 4. invoices — no world-readable dump
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "invoices_public_view_by_id" ON public.invoices;

DROP POLICY IF EXISTS invoices_select_owner ON public.invoices;
CREATE POLICY invoices_select_owner ON public.invoices
  FOR SELECT USING (
    auth.uid() = owner_id
    OR lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(COALESCE(auth.jwt() ->> 'email', ''))
        AND s.status = 'active'
    )
  );

-- --------------------------------------------------------------------------
-- 5. Narrow staff ALL → SELECT on transactions / deposits
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS transactions_staff_all ON public.transactions;
CREATE POLICY transactions_staff_select ON public.transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(COALESCE(auth.jwt() ->> 'email', ''))
        AND s.status = 'active'
    )
  );

DROP POLICY IF EXISTS deposits_staff_all ON public.deposits;
CREATE POLICY deposits_staff_select ON public.deposits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(COALESCE(auth.jwt() ->> 'email', ''))
        AND s.status = 'active'
    )
  );

-- Keep user insert on deposits for now; create_deposit_request preferred
-- (insert still allowed for backwards compat until clients migrate — fee ignored on approve)

-- --------------------------------------------------------------------------
-- 6. platform_limit_settings
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_limit_settings (
  limit_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  value NUMERIC NOT NULL CHECK (value >= 0),
  unit TEXT NOT NULL DEFAULT 'htg',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE public.platform_limit_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_limit_settings_admin_select ON public.platform_limit_settings;
CREATE POLICY platform_limit_settings_admin_select ON public.platform_limit_settings
  FOR SELECT USING (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
  );

INSERT INTO public.platform_limit_settings (limit_key, label, value, unit, description) VALUES
  ('individual_daily_limit', 'Limit jounalye endividyèl', 75000, 'htg', 'Depans/retrè/transfè pa jou'),
  ('individual_monthly_limit', 'Limit mansyèl endividyèl', 250000, 'htg', 'Depans/retrè/transfè pa mwa'),
  ('individual_invoice_daily_limit', 'Limit fakti jounalye', 85000, 'htg', 'Total fakti kreye pa jou (endividyèl)'),
  ('individual_max_wallet', 'Plafon wallet endividyèl', 105000, 'htg', 'Balans maksimòm'),
  ('enterprise_max_wallet', 'Plafon wallet antrepriz', 2000000, 'htg', 'Balans maksimòm biznis'),
  ('enterprise_card_daily_limit', 'Limit kat antrepriz / jou', 100000, 'htg', NULL),
  ('enterprise_card_monthly_limit', 'Limit kat antrepriz / mwa', 480000, 'htg', NULL),
  ('api_receive_individual', 'Limit API resevwa endividyèl', 50000, 'htg', NULL),
  ('api_receive_enterprise', 'Limit API resevwa antrepriz', 2000000, 'htg', NULL),
  ('min_deposit', 'Depo minimòm', 500, 'htg', NULL),
  ('min_withdraw', 'Retrè minimòm', 500, 'htg', NULL),
  ('vip_withdraw_threshold', 'Sèy VIP retrè', 15000, 'htg', 'Retrè MonCash san frè anwo sèy sa a'),
  ('card_recharge_max', 'Rechaj kat maksimòm', 70000, 'htg', NULL),
  ('agent_pro_capacity', 'Kapasite ajan PRO', 55000, 'htg', NULL),
  ('agent_premium_capacity', 'Kapasite ajan PREMIUM', 110000, 'htg', NULL),
  ('agent_withdraw_share_rate', 'Pati frè ajan (retrè)', 0.2, 'rate', '0–1')
ON CONFLICT (limit_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.hatex_resolve_limit(
  p_limit_key TEXT,
  p_default NUMERIC DEFAULT 0
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val NUMERIC;
BEGIN
  SELECT value INTO v_val
  FROM public.platform_limit_settings
  WHERE limit_key = p_limit_key;
  IF v_val IS NULL THEN
    RETURN COALESCE(p_default, 0);
  END IF;
  RETURN v_val;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_resolve_limit(TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hatex_resolve_limit(TEXT, NUMERIC) TO authenticated, service_role;

-- --------------------------------------------------------------------------
-- 7. transfer_fee_tiers
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transfer_fee_tiers (
  id SERIAL PRIMARY KEY,
  min_amount NUMERIC NOT NULL,
  max_amount NUMERIC NOT NULL,
  base_fee NUMERIC NOT NULL DEFAULT 0,
  CONSTRAINT transfer_fee_tiers_range CHECK (min_amount <= max_amount)
);

ALTER TABLE public.transfer_fee_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transfer_fee_tiers_read ON public.transfer_fee_tiers;
CREATE POLICY transfer_fee_tiers_read ON public.transfer_fee_tiers
  FOR SELECT USING (true);

INSERT INTO public.transfer_fee_tiers (min_amount, max_amount, base_fee)
SELECT * FROM (VALUES
  (100::numeric, 249::numeric, 0::numeric),
  (250, 499, 5),
  (500, 999, 10),
  (1000, 1999, 25),
  (2000, 3999, 35),
  (4000, 7999, 50),
  (8000, 11999, 60),
  (12000, 19999, 70),
  (20000, 39999, 75),
  (40000, 59999, 100),
  (60000, 74999, 120),
  (75000, 100000, 130)
) AS v(min_amount, max_amount, base_fee)
WHERE NOT EXISTS (SELECT 1 FROM public.transfer_fee_tiers LIMIT 1);

CREATE OR REPLACE FUNCTION public.hatex_transfer_fee(
  p_amount NUMERIC,
  p_user_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base NUMERIC;
  v_scale NUMERIC;
BEGIN
  SELECT t.base_fee INTO v_base
  FROM public.transfer_fee_tiers t
  WHERE p_amount BETWEEN t.min_amount AND t.max_amount
  ORDER BY t.min_amount
  LIMIT 1;

  IF v_base IS NULL THEN
    v_base := 0;
  END IF;

  v_scale := public.hatex_resolve_fee('transfer_fee_percent', p_user_id, 5);
  RETURN ROUND(v_base * (v_scale / 5.0), 2);
END;
$$;

-- --------------------------------------------------------------------------
-- 8. agent_tiers
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_tiers (
  tier TEXT PRIMARY KEY,
  capacity_htg NUMERIC NOT NULL CHECK (capacity_htg > 0),
  label TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_tiers_read ON public.agent_tiers;
CREATE POLICY agent_tiers_read ON public.agent_tiers
  FOR SELECT USING (true);

INSERT INTO public.agent_tiers (tier, capacity_htg, label) VALUES
  ('pro', 55000, 'PRO'),
  ('premium', 110000, 'PREMIUM')
ON CONFLICT (tier) DO UPDATE
SET capacity_htg = EXCLUDED.capacity_htg,
    label = EXCLUDED.label,
    updated_at = now();

-- --------------------------------------------------------------------------
-- 9. create_deposit_request — fee computed server-side
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_deposit_request(
  p_amount NUMERIC,
  p_method TEXT,
  p_transaction_id TEXT,
  p_proof_img_1 TEXT,
  p_proof_img_2 TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_min NUMERIC;
  v_fee_pct NUMERIC;
  v_fee NUMERIC;
  v_total NUMERIC;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Ou dwe konekte.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  v_min := public.hatex_resolve_limit('min_deposit', 500);
  IF p_amount < v_min THEN
    RETURN json_build_object('success', false, 'message', 'Depo minimòm se ' || v_min || ' HTG.');
  END IF;

  IF p_method IS NULL OR length(trim(p_method)) = 0 THEN
    RETURN json_build_object('success', false, 'message', 'Metòd manke.');
  END IF;

  IF p_transaction_id IS NULL OR length(trim(p_transaction_id)) = 0 THEN
    RETURN json_build_object('success', false, 'message', 'ID tranzaksyon manke.');
  END IF;

  IF p_proof_img_1 IS NULL OR length(trim(p_proof_img_1)) = 0 THEN
    RETURN json_build_object('success', false, 'message', 'Prèv depo manke.');
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;
  v_fee_pct := public.hatex_resolve_fee('deposit_fee_percent', v_uid, 5);
  v_fee := ROUND(p_amount * (v_fee_pct / 100.0), 2);
  v_total := ROUND(p_amount + v_fee, 2);

  INSERT INTO public.deposits (
    user_id, amount, fee, total_to_pay, method, user_email,
    transaction_id, proof_img_1, proof_img_2, status
  ) VALUES (
    v_uid, p_amount, v_fee, v_total, trim(p_method), v_email,
    trim(p_transaction_id), p_proof_img_1, COALESCE(p_proof_img_2, p_proof_img_1), 'pending'
  )
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'success', true,
    'deposit_id', v_id,
    'amount', p_amount,
    'fee', v_fee,
    'total_to_pay', v_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_deposit_request(NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_deposit_request(NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Block client from inserting arbitrary fee via direct INSERT (optional hardening)
DROP POLICY IF EXISTS deposits_insert_own ON public.deposits;
DROP POLICY IF EXISTS "Users can insert own deposits" ON public.deposits;
-- Recreate insert only if we want RPC-only; use restrictive policy that fails fee mismatch
-- Prefer: no direct insert — only RPC (service_role / security definer bypasses RLS)
CREATE POLICY deposits_insert_deny ON public.deposits
  FOR INSERT WITH CHECK (false);

-- --------------------------------------------------------------------------
-- 10. admin_approve_deposit — recompute fee from settings
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(
  p_deposit_id UUID,
  p_final_amount NUMERIC DEFAULT NULL,
  p_fee NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep RECORD;
  v_amount NUMERIC;
  v_fee NUMERIC;
  v_fee_pct NUMERIC;
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_is_admin BOOLEAN;
  v_is_staff BOOLEAN;
  v_bal NUMERIC;
  v_type TEXT;
  v_max NUMERIC;
  v_new_bal NUMERIC;
BEGIN
  v_is_admin := v_email = 'adminhatexcard@gmail.com';
  v_is_staff := EXISTS (
    SELECT 1 FROM public.staff_users WHERE email = v_email AND status = 'active'
  );
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT (v_is_admin OR v_is_staff) THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Depo pa jwenn.');
  END IF;
  IF v_dep.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Depo sa a deja trete.', 'status', v_dep.status);
  END IF;

  v_amount := COALESCE(p_final_amount, v_dep.amount);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  -- Toujou rekalkile frè nan baz (inyore p_fee kliyan/admin)
  v_fee_pct := public.hatex_resolve_fee('deposit_fee_percent', v_dep.user_id, 5);
  v_fee := ROUND(v_amount * (v_fee_pct / 100.0), 2);

  SELECT wallet_balance, account_type INTO v_bal, v_type
  FROM public.profiles WHERE id = v_dep.user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Pwofil kliyan pa jwenn.');
  END IF;

  v_max := CASE
    WHEN v_type = 'business' THEN public.hatex_resolve_limit('enterprise_max_wallet', 2000000)
    ELSE public.hatex_resolve_limit('individual_max_wallet', 105000)
  END;
  IF (COALESCE(v_bal, 0) + v_amount) > v_max THEN
    RETURN json_build_object('success', false, 'message', 'Balans ta depase limit maksimòm.');
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount
  WHERE id = v_dep.user_id
  RETURNING wallet_balance INTO v_new_bal;

  IF v_new_bal IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Pa t kapab kredite wallet.');
  END IF;

  UPDATE public.deposits
  SET status = 'approved',
      amount = v_amount,
      fee = v_fee,
      total_to_pay = ROUND(v_amount + v_fee, 2)
  WHERE id = p_deposit_id;

  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (v_dep.user_id, v_amount, 'DEPOSIT', 'Depo konfime: +' || v_amount || ' HTG', 'success');

  RETURN json_build_object(
    'success', true,
    'message', 'Depo apwouve.',
    'amount', v_amount,
    'fee', v_fee,
    'wallet_balance', v_new_bal
  );
END;
$$;

-- --------------------------------------------------------------------------
-- 11. process_card_recharge — enforce max from platform_limit_settings
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_card_recharge(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet NUMERIC;
  v_max NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen otorizasyon pou operasyon sa a.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  v_max := public.hatex_resolve_limit('card_recharge_max', 70000);
  IF p_amount > v_max THEN
    RETURN json_build_object('success', false, 'message', 'Rechaj maksimòm se ' || v_max || ' HTG.');
  END IF;

  SELECT wallet_balance INTO v_wallet FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;

  IF COALESCE(v_wallet, 0) < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Balans wallet pa ase.');
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - p_amount,
      card_balance = COALESCE(card_balance, 0) + p_amount
  WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'message', 'Kat ou rechaje ak siksè!');
END;
$$;

-- --------------------------------------------------------------------------
-- 12. Invoice daily limit (DB enforce)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hatex_enforce_invoice_daily_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
  v_limit NUMERIC;
  v_sum NUMERIC;
BEGIN
  SELECT account_type INTO v_type FROM public.profiles WHERE id = NEW.owner_id;
  IF v_type = 'business' THEN
    RETURN NEW;
  END IF;

  v_limit := public.hatex_resolve_limit('individual_invoice_daily_limit', 85000);

  SELECT COALESCE(SUM(amount), 0) INTO v_sum
  FROM public.invoices
  WHERE owner_id = NEW.owner_id
    AND status IS DISTINCT FROM 'cancelled'
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'America/Port-au-Prince')
    AND id IS DISTINCT FROM NEW.id;

  IF (v_sum + COALESCE(NEW.amount, 0)) > v_limit THEN
    RAISE EXCEPTION 'Limit jounalye pou fakti se % HTG.', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_daily_limit ON public.invoices;
CREATE TRIGGER trg_invoice_daily_limit
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.hatex_enforce_invoice_daily_limit();

-- --------------------------------------------------------------------------
-- 13. process_kyc_fee — atomic
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_kyc_fee(p_user_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_bal NUMERIC;
  v_status TEXT;
  v_kyc TEXT;
  v_paid BOOLEAN;
  v_base NUMERIC;
  v_discount NUMERIC;
  v_charge NUMERIC;
  v_new NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_uid AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  SELECT wallet_balance, account_status, kyc_status, COALESCE(kyc_fee_paid, false)
    INTO v_bal, v_status, v_kyc, v_paid
  FROM public.profiles WHERE id = v_uid FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Pwofil pa jwenn.');
  END IF;
  IF v_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ou sispandi.');
  END IF;
  IF v_kyc = 'approved' THEN
    RETURN json_build_object('success', false, 'message', 'KYC ou deja apwouve.');
  END IF;
  IF v_paid THEN
    RETURN json_build_object('success', true, 'already_paid', true, 'message', 'Frè KYC deja peye.');
  END IF;

  v_base := public.hatex_resolve_fee('kyc_fee', v_uid, 1150);
  SELECT COALESCE(discount_amount, 0) INTO v_discount
  FROM public.user_discounts WHERE user_id = v_uid;
  v_discount := COALESCE(v_discount, 0);
  v_charge := GREATEST(0, v_base - v_discount);

  IF COALESCE(v_bal, 0) < v_charge THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Ou pa gen ase kòb.',
      'amount_due_htg', v_charge,
      'wallet_balance_htg', v_bal,
      'needs_deposit', true
    );
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) - v_charge,
      kyc_fee_paid = true
  WHERE id = v_uid
  RETURNING wallet_balance INTO v_new;

  INSERT INTO public.transactions (user_id, amount, type, status, description)
  VALUES (
    v_uid, -v_charge, 'KYC_FEE', 'success',
    CASE WHEN v_discount > 0
      THEN 'Frè KYC konplè (kat enkli, rediksyon -' || v_discount || ' HTG)'
      ELSE 'Frè KYC konplè (verifikasyon ID + kat vityèl)'
    END
  );

  RETURN json_build_object(
    'success', true,
    'charged_htg', v_charge,
    'wallet_balance_htg', v_new
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_kyc_fee(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_kyc_fee(UUID) TO authenticated, service_role;

-- --------------------------------------------------------------------------
-- 14. process_plugin_refund — atomic
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_plugin_refund(
  p_transaction_id UUID,
  p_merchant_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_amount NUMERIC;
  v_mbal NUMERIC;
  v_client_id UUID;
  v_client_email TEXT;
  v_max NUMERIC;
  v_ctype TEXT;
  v_cbal NUMERIC;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  SELECT * INTO v_tx
  FROM public.plugin_transactions
  WHERE id = p_transaction_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Tranzaksyon pa jwenn.');
  END IF;
  IF v_tx.status = 'refunded' THEN
    RETURN json_build_object('success', false, 'message', 'Deja ranbouse.');
  END IF;

  v_amount := COALESCE(v_tx.amount_htg, 0);
  IF v_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  SELECT wallet_balance INTO v_mbal FROM public.profiles WHERE id = p_merchant_id FOR UPDATE;
  IF COALESCE(v_mbal, 0) < v_amount THEN
    RETURN json_build_object('success', false, 'message', 'Balans machann ensifizan.');
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) - v_amount
  WHERE id = p_merchant_id;

  v_client_email := lower(COALESCE(v_tx.customer_info->>'email', ''));
  IF v_client_email <> '' THEN
    SELECT id, card_balance, account_type
      INTO v_client_id, v_cbal, v_ctype
    FROM public.profiles WHERE email = v_client_email FOR UPDATE;

    IF v_client_id IS NOT NULL THEN
      -- Cap-exempt: returning customer's own money to card
      UPDATE public.profiles
      SET card_balance = COALESCE(card_balance, 0) + v_amount
      WHERE id = v_client_id;
    END IF;
  END IF;

  UPDATE public.plugin_transactions
  SET status = 'refunded',
      refund_reason = COALESCE(p_reason, 'Kliyan an mande ranbousman'),
      refunded_at = now()
  WHERE id = p_transaction_id;

  RETURN json_build_object('success', true, 'refunded', v_amount, 'client_email', NULLIF(v_client_email, ''));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_plugin_refund(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_plugin_refund(UUID, UUID, TEXT) TO service_role;

COMMENT ON TABLE public.platform_limit_settings IS 'Limit sistèm (admin editable). SQL RPCs rele hatex_resolve_limit.';
COMMENT ON TABLE public.transfer_fee_tiers IS 'Tablo frè baz P2P; hatex_transfer_fee aplike scale transfer_fee_percent.';
COMMENT ON TABLE public.agent_tiers IS 'Kapasite ajan pa nivo (pro/premium).';
