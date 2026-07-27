-- ============================================================================
-- Limit / frè / retrè / checkout lock — verifye TOUT nan DB
-- ============================================================================

-- 1) Frè API = 0 HTG
UPDATE public.platform_fee_settings
SET value = 0, updated_at = now()
WHERE fee_key = 'api_fee_per_1000';

INSERT INTO public.platform_fee_settings (fee_key, label, value, unit, description)
VALUES ('api_fee_per_1000', 'Frè API resevwa', 0, 'per_1000', '0 HTG / 1000 — gratis')
ON CONFLICT (fee_key) DO UPDATE
SET value = 0, updated_at = now(), description = EXCLUDED.description;

-- 2) Plafon wallet + limit API resevwa
UPDATE public.platform_limit_settings SET value = 1200000, updated_at = now()
WHERE limit_key = 'individual_max_wallet';
UPDATE public.platform_limit_settings SET value = 12000000, updated_at = now()
WHERE limit_key = 'enterprise_max_wallet';
UPDATE public.platform_limit_settings SET value = 1000000, updated_at = now()
WHERE limit_key = 'api_receive_individual';
UPDATE public.platform_limit_settings SET value = 10000000, updated_at = now()
WHERE limit_key = 'api_receive_enterprise';

INSERT INTO public.platform_limit_settings (limit_key, label, value, unit, description) VALUES
  ('individual_max_wallet', 'Plafon wallet endividyèl', 1200000, 'htg', 'Balans maksimòm'),
  ('enterprise_max_wallet', 'Plafon wallet antrepriz', 12000000, 'htg', 'Balans maksimòm biznis'),
  ('api_receive_individual', 'Limit API resevwa endividyèl', 1000000, 'htg', NULL),
  ('api_receive_enterprise', 'Limit API resevwa antrepriz', 10000000, 'htg', NULL),
  ('individual_withdraw_max_per_tx', 'Retrè max / tranzaksyon (endividyèl)', 25000, 'htg', NULL),
  ('individual_withdraw_max_count_daily', 'Kantite retrè / jou (endividyèl)', 5, 'count', NULL),
  ('enterprise_withdraw_max_per_tx', 'Retrè max / tranzaksyon (antrepriz)', 75000, 'htg', NULL),
  ('enterprise_withdraw_max_count_daily', 'Kantite retrè / jou (antrepriz)', 12, 'count', NULL)
ON CONFLICT (limit_key) DO UPDATE
SET value = EXCLUDED.value, label = EXCLUDED.label, updated_at = now(), description = EXCLUDED.description;

-- 3) Checkout lock — montan QR bloke nan DB anvan peman
CREATE TABLE IF NOT EXISTS public.checkout_payment_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id TEXT NOT NULL,
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_locks_token ON public.checkout_payment_locks (token_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_locks_unused ON public.checkout_payment_locks (id) WHERE used_at IS NULL;

ALTER TABLE public.checkout_payment_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_payment_locks FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.checkout_payment_locks TO service_role;

-- 4) Assert retrè: max pa tx + kantite / jou (endividyèl ak antrepriz)
CREATE OR REPLACE FUNCTION public.hatex_assert_withdraw_rules(
  p_user_id UUID,
  p_account_type TEXT,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_biz BOOLEAN;
  v_max_tx NUMERIC;
  v_max_count NUMERIC;
  v_day_start TIMESTAMPTZ;
  v_count INT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montan pa valab.';
  END IF;

  v_is_biz := COALESCE(p_account_type, 'individual') = 'business';
  v_max_tx := CASE
    WHEN v_is_biz THEN public.hatex_resolve_limit('enterprise_withdraw_max_per_tx', 75000)
    ELSE public.hatex_resolve_limit('individual_withdraw_max_per_tx', 25000)
  END;
  v_max_count := CASE
    WHEN v_is_biz THEN public.hatex_resolve_limit('enterprise_withdraw_max_count_daily', 12)
    ELSE public.hatex_resolve_limit('individual_withdraw_max_count_daily', 5)
  END;

  IF p_amount > v_max_tx THEN
    RAISE EXCEPTION 'Yon sèl retrè pa ka depase % HTG pou kont sa a.', v_max_tx;
  END IF;

  v_day_start := date_trunc('day', NOW() AT TIME ZONE 'America/Port-au-Prince')
    AT TIME ZONE 'America/Port-au-Prince';

  SELECT COUNT(*)::INT INTO v_count
  FROM public.withdrawals w
  WHERE w.user_id = p_user_id
    AND w.created_at >= v_day_start
    AND COALESCE(w.status, '') NOT IN ('rejected', 'cancelled', 'failed');

  -- Retrè ajan (pa toujou nan tab withdrawals)
  v_count := v_count + (
    SELECT COUNT(*)::INT
    FROM public.transactions t
    WHERE t.user_id = p_user_id
      AND t.type = 'AGENT_WITHDRAWAL_CLIENT'
      AND t.amount < 0
      AND t.created_at >= v_day_start
  );

  IF v_count >= v_max_count THEN
    RAISE EXCEPTION 'Ou rive nan limit % retrè pa jou pou kont sa a.', v_max_count;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_assert_withdraw_rules(UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hatex_assert_withdraw_rules(UUID, TEXT, NUMERIC) TO authenticated, service_role;

-- 5) process_direct_card_payment — frè default 0 + limit dinamik
CREATE OR REPLACE FUNCTION public.process_direct_card_payment(
  p_client_id UUID,
  p_merchant_id UUID,
  p_amount NUMERIC,
  p_order_id TEXT DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_merchant_name TEXT DEFAULT NULL,
  p_daily_received_so_far NUMERIC DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_card_balance NUMERIC;
  v_client_wallet_balance NUMERIC;
  v_client_status TEXT;
  v_merchant_balance NUMERIC;
  v_merchant_account_type TEXT;
  v_debit_source TEXT;
  v_max_balance NUMERIC;
  v_transaction_ref TEXT;
  v_client_tx_id UUID;
  v_merchant_tx_id UUID;
  v_daily_cap NUMERIC;
  v_api_fee NUMERIC;
  v_merchant_net NUMERIC;
  v_fee_rate NUMERIC;
  v_kes NUMERIC;
  v_freeze_msg TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;
  IF p_client_id = p_merchant_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa ka peye tèt ou.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id IN (p_client_id, p_merchant_id) FOR UPDATE;

  v_freeze_msg := public.hatex_reject_if_card_frozen(p_client_id);
  IF v_freeze_msg IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', v_freeze_msg, 'card_frozen', true);
  END IF;

  SELECT card_balance, wallet_balance, account_status
  INTO v_client_card_balance, v_client_wallet_balance, v_client_status
  FROM public.profiles WHERE id = p_client_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kat kliyan an pa rekonèt.');
  END IF;
  IF v_client_status IS DISTINCT FROM 'active' THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan an pa aktif.');
  END IF;

  IF COALESCE(v_client_card_balance, 0) >= p_amount THEN
    v_debit_source := 'card';
  ELSIF COALESCE(v_client_wallet_balance, 0) >= p_amount THEN
    v_debit_source := 'wallet';
  ELSE
    RETURN json_build_object('success', false, 'message', 'Fon ensifizan');
  END IF;

  SELECT wallet_balance, account_type
  INTO v_merchant_balance, v_merchant_account_type
  FROM public.profiles WHERE id = p_merchant_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Machann pa jwenn.');
  END IF;

  v_fee_rate := public.hatex_resolve_fee('api_fee_per_1000', p_merchant_id, 0);
  v_api_fee := ROUND((p_amount / 1000.0) * v_fee_rate, 2);
  v_merchant_net := ROUND(p_amount - v_api_fee, 2);

  v_daily_cap := CASE
    WHEN v_merchant_account_type = 'business' THEN public.hatex_resolve_limit('api_receive_enterprise', 10000000)
    ELSE public.hatex_resolve_limit('api_receive_individual', 1000000)
  END;
  IF (COALESCE(p_daily_received_so_far, 0) + p_amount) > v_daily_cap THEN
    RETURN json_build_object('success', false, 'message', 'Machann nan rive nan limit resepsyon jounalye a.');
  END IF;

  v_max_balance := CASE
    WHEN v_merchant_account_type = 'business' THEN public.hatex_resolve_limit('enterprise_max_wallet', 12000000)
    ELSE public.hatex_resolve_limit('individual_max_wallet', 1200000)
  END;
  IF (COALESCE(v_merchant_balance, 0) + v_merchant_net) > v_max_balance THEN
    RETURN json_build_object(
      'success', false,
      'message',
      'Balans machann nan ta depase limit maksimòm otorize a (' || v_max_balance || ' HTG).'
    );
  END IF;

  IF v_debit_source = 'card' THEN
    UPDATE public.profiles SET card_balance = card_balance - p_amount WHERE id = p_client_id;
  ELSE
    UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_client_id;
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_merchant_net
  WHERE id = p_merchant_id;

  v_transaction_ref := 'HTX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
  VALUES (
    p_client_id, -p_amount, 'PURCHASE',
    'Peman sou entènèt: ' || COALESCE(p_merchant_name, 'Machann')
      || ' (Kòmand #' || COALESCE(NULLIF(p_order_id, ''), 'N/A') || ')',
    'success', v_transaction_ref || '-C',
    jsonb_build_object('source', 'public_api', 'debit_from', v_debit_source, 'tx_ref', v_transaction_ref, 'api_fee', v_api_fee)
  )
  RETURNING id INTO v_client_tx_id;

  INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
  VALUES (
    p_merchant_id, v_merchant_net, 'SALE',
    CASE WHEN v_api_fee > 0
      THEN 'Lavant sou entènèt (net) — frè API: ' || v_api_fee || ' HTG'
      ELSE 'Lavant sou entènèt (net) — 0 frè API'
    END,
    'success', v_transaction_ref || '-M',
    jsonb_build_object('source', 'public_api', 'gross_amount', p_amount, 'api_fee', v_api_fee, 'net_amount', v_merchant_net)
  )
  RETURNING id INTO v_merchant_tx_id;

  IF v_api_fee > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
    VALUES (
      p_merchant_id, -v_api_fee, 'API_FEE',
      'Frè API (' || v_fee_rate || ' HTG / 1 000)',
      'success', v_transaction_ref || '-F',
      jsonb_build_object('source', 'public_api', 'gross_amount', p_amount, 'fee_rate_per_1000', v_fee_rate)
    );
    BEGIN
      v_kes := public.hatex_credit_kes_global(v_api_fee, 'api_receive_fee');
    EXCEPTION WHEN OTHERS THEN
      v_kes := NULL;
    END;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Peman an fèt ak siksè!',
    'transaction_id', v_client_tx_id,
    'reference', v_transaction_ref,
    'merchant_transaction_id', v_merchant_tx_id,
    'debited_from', v_debit_source,
    'gross_amount', p_amount,
    'api_fee', v_api_fee,
    'net_amount', v_merchant_net,
    'kes_global_balance', v_kes
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) TO service_role;

-- 6) Patch process_wallet_withdrawal: rele hatex_assert_withdraw_rules
-- Nou wrap ak yon trigger-style helper lè yo rele assert spending
CREATE OR REPLACE FUNCTION public.hatex_assert_individual_spending_limit(
  p_user_id UUID,
  p_account_type TEXT,
  p_amount NUMERIC,
  p_channel TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_daily NUMERIC;
  c_monthly NUMERIC;
  v_day_start TIMESTAMPTZ;
  v_month_start TIMESTAMPTZ;
  v_today_total NUMERIC;
  v_month_total NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montan pa valab.';
  END IF;

  -- Retrè: règ espesyal (kantite + max pa tx) pou TOUT tip kont
  IF p_channel = 'withdraw' THEN
    PERFORM public.hatex_assert_withdraw_rules(p_user_id, p_account_type, p_amount);
    RETURN;
  END IF;

  -- Transfè: antrepriz san limit jounalye/mansyèl
  IF COALESCE(p_account_type, 'individual') = 'business'
     AND p_channel = 'transfer' THEN
    RETURN;
  END IF;

  c_daily := public.hatex_resolve_limit('individual_daily_limit', 75000);
  c_monthly := public.hatex_resolve_limit('individual_monthly_limit', 250000);

  v_day_start := date_trunc('day', NOW() AT TIME ZONE 'America/Port-au-Prince')
    AT TIME ZONE 'America/Port-au-Prince';
  v_month_start := date_trunc('month', NOW() AT TIME ZONE 'America/Port-au-Prince')
    AT TIME ZONE 'America/Port-au-Prince';

  IF p_channel = 'transfer' THEN
    v_today_total := public.hatex_sum_p2p_sent_since(p_user_id, v_day_start);
    v_month_total := public.hatex_sum_p2p_sent_since(p_user_id, v_month_start);
  ELSE
    RAISE EXCEPTION 'Kanal limit pa valab.';
  END IF;

  IF v_today_total + p_amount > c_daily THEN
    RAISE EXCEPTION 'Limit jounalye a se % HTG. Ou gentan itilize % HTG jodi a.', c_daily, v_today_total;
  END IF;

  IF v_month_total + p_amount > c_monthly THEN
    RAISE EXCEPTION 'Limit mansyèl la se % HTG. Ou gentan itilize % HTG mwa sa a.', c_monthly, v_month_total;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_assert_individual_spending_limit(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hatex_assert_individual_spending_limit(UUID, TEXT, NUMERIC, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- 7) Transfè: plafon wallet dinamik
CREATE OR REPLACE FUNCTION public.hatex_wallet_cap_for_account(p_account_type TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(p_account_type, 'individual') = 'business'
      THEN public.hatex_resolve_limit('enterprise_max_wallet', 12000000)
    ELSE public.hatex_resolve_limit('individual_max_wallet', 1200000)
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_wallet_cap_for_account(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hatex_wallet_cap_for_account(TEXT) TO authenticated, service_role;
