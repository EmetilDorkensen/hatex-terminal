-- ============================================================================
-- Friz / defriz kat vityèl (PIN verify bò API; estati + bloke peman nan baz)
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_card_frozen BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_card_frozen IS
  'Si true, kat pa ka peye anyen (tout RPC debit kat/wallet via kat). Friz/defriz mande PIN.';

-- Mesaj erè si kat friz (null = OK)
CREATE OR REPLACE FUNCTION public.hatex_reject_if_card_frozen(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_frozen BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 'Kat pa rekonèt.';
  END IF;
  SELECT COALESCE(is_card_frozen, false) INTO v_frozen
  FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN 'Kat pa rekonèt.';
  END IF;
  IF v_frozen THEN
    RETURN 'Kat ou friz. Defriz li nan paj Kat (PIN obligatwa) anvan ou ka peye.';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_reject_if_card_frozen(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hatex_reject_if_card_frozen(UUID) TO authenticated, service_role;

-- Friz / defriz (sèlman pwopriyetè oswa service_role). PIN verify fèt nan API anvan.
CREATE OR REPLACE FUNCTION public.set_card_frozen(
  p_frozen BOOLEAN,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_status TEXT;
  v_activated BOOLEAN;
  v_current BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Ou dwe konekte.');
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_uid AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  IF p_frozen IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Paramèt friz manke.');
  END IF;

  SELECT account_status, COALESCE(is_card_activated, false), COALESCE(is_card_frozen, false)
    INTO v_status, v_activated, v_current
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Pwofil pa jwenn.');
  END IF;

  IF v_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ou sispandi.');
  END IF;

  IF NOT v_activated THEN
    RETURN json_build_object('success', false, 'message', 'Kat ou poko aktive. Debloke opsyon yo anvan.');
  END IF;

  IF v_current = p_frozen THEN
    RETURN json_build_object(
      'success', true,
      'already', true,
      'is_card_frozen', v_current,
      'message', CASE WHEN p_frozen THEN 'Kat la deja friz.' ELSE 'Kat la deja aktif.' END
    );
  END IF;

  UPDATE public.profiles
  SET is_card_frozen = p_frozen
  WHERE id = v_uid;

  INSERT INTO public.transactions (user_id, amount, type, status, description, metadata)
  VALUES (
    v_uid, 0,
    CASE WHEN p_frozen THEN 'CARD_FREEZE' ELSE 'CARD_UNFREEZE' END,
    'success',
    CASE WHEN p_frozen THEN 'Kat friz pa pwopriyetè a' ELSE 'Kat defriz / reaktive pa pwopriyetè a' END,
    jsonb_build_object('is_card_frozen', p_frozen, 'source', 'set_card_frozen')
  );

  RETURN json_build_object(
    'success', true,
    'is_card_frozen', p_frozen,
    'message', CASE WHEN p_frozen
      THEN 'Kat friz. Ou pa ka peye jiskaske ou defriz li.'
      ELSE 'Kat aktif ankò. Ou ka peye.'
    END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_card_frozen(BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_card_frozen(BOOLEAN, UUID) TO authenticated, service_role;

-- Trigger: pa kite okenn debit card_balance si kat friz (defans pwofon)
CREATE OR REPLACE FUNCTION public.hatex_prevent_frozen_card_debit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.card_balance IS DISTINCT FROM OLD.card_balance
     AND COALESCE(NEW.card_balance, 0) < COALESCE(OLD.card_balance, 0)
     AND COALESCE(OLD.is_card_frozen, false) = true THEN
    RAISE EXCEPTION 'Kat friz: pa ka debite card_balance.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_frozen_card_debit ON public.profiles;
CREATE TRIGGER trg_prevent_frozen_card_debit
  BEFORE UPDATE OF card_balance ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.hatex_prevent_frozen_card_debit();

-- ---------------------------------------------------------------------------
-- Patch peman RPC: bloke si kliyan an gen kat friz
-- ---------------------------------------------------------------------------

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
    RETURN json_build_object(
      'success', false,
      'message',
      'Ou pa gen ase fon. Kat: ' || COALESCE(v_client_card_balance, 0)
        || ' HTG, Wallet: ' || COALESCE(v_client_wallet_balance, 0) || ' HTG.'
    );
  END IF;

  SELECT wallet_balance, account_type
  INTO v_merchant_balance, v_merchant_account_type
  FROM public.profiles WHERE id = p_merchant_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Machann pa jwenn.');
  END IF;

  v_fee_rate := public.hatex_resolve_fee('api_fee_per_1000', p_merchant_id, 3);
  v_api_fee := ROUND((p_amount / 1000.0) * v_fee_rate, 2);
  v_merchant_net := ROUND(p_amount - v_api_fee, 2);

  v_daily_cap := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 50000 END;
  IF (COALESCE(p_daily_received_so_far, 0) + p_amount) > v_daily_cap THEN
    RETURN json_build_object('success', false, 'message', 'Machann nan rive nan limit resepsyon jounalye a.');
  END IF;

  v_max_balance := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 105000 END;
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
    'Lavant sou entènèt (net) — frè API: ' || v_api_fee || ' HTG',
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

CREATE OR REPLACE FUNCTION public.process_invoice_card_payment(
  p_invoice_id UUID,
  p_client_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_client_status TEXT;
  v_client_card NUMERIC;
  v_merchant_bal NUMERIC;
  v_merchant_type TEXT;
  v_max_bal NUMERIC;
  v_ref TEXT;
  v_freeze_msg TEXT;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Fakti pa jwenn.');
  END IF;
  IF v_inv.status = 'paid' THEN
    RETURN json_build_object('success', false, 'message', 'Fakti sa a te deja peye.');
  END IF;
  IF v_inv.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Fakti sa a pa disponib pou peman.');
  END IF;
  IF p_client_id = v_inv.owner_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa ka peye pwòp fakti ou.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id IN (p_client_id, v_inv.owner_id) FOR UPDATE;

  v_freeze_msg := public.hatex_reject_if_card_frozen(p_client_id);
  IF v_freeze_msg IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', v_freeze_msg, 'card_frozen', true);
  END IF;

  SELECT account_status, COALESCE(card_balance, 0)
    INTO v_client_status, v_client_card
  FROM public.profiles WHERE id = p_client_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kat kliyan an pa rekonèt.');
  END IF;
  IF v_client_status IS DISTINCT FROM 'active' THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan an pa aktif.');
  END IF;
  IF v_client_card < v_inv.amount THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase fon sou kat ou a.');
  END IF;

  SELECT COALESCE(wallet_balance, 0), account_type
    INTO v_merchant_bal, v_merchant_type
  FROM public.profiles WHERE id = v_inv.owner_id;

  v_max_bal := CASE WHEN v_merchant_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (v_merchant_bal + v_inv.amount) > v_max_bal THEN
    RETURN json_build_object('success', false, 'message', 'Balans machann nan ta depase limit maksimòm.');
  END IF;

  v_ref := 'INV-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 9));

  UPDATE public.profiles SET card_balance = card_balance - v_inv.amount WHERE id = p_client_id;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + v_inv.amount WHERE id = v_inv.owner_id;

  UPDATE public.invoices
  SET status = 'paid', paid_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id, metadata)
  VALUES (
    v_inv.owner_id, v_inv.amount, 'SALE', 'success',
    'Peman Fakti: ' || COALESCE(v_inv.description, 'Invoice') || ' (' || v_inv.client_email || ')',
    v_ref || '-M',
    jsonb_build_object('source', 'invoice', 'invoice_id', p_invoice_id, 'wallet_synced', true)
  );

  INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id, metadata)
  VALUES (
    p_client_id, -v_inv.amount, 'PAYMENT', 'success',
    'Peman Fakti Hatex',
    v_ref || '-C',
    jsonb_build_object('source', 'invoice', 'invoice_id', p_invoice_id)
  );

  RETURN json_build_object('success', true, 'message', 'Peman an reyisi!', 'reference', v_ref);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_invoice_card_payment(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_invoice_card_payment(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.process_subscription_card_payment(
  p_client_id UUID,
  p_merchant_id UUID,
  p_amount NUMERIC,
  p_plan_name TEXT,
  p_masked_name TEXT,
  p_client_email TEXT,
  p_shop_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_status TEXT;
  v_client_card_balance NUMERIC;
  v_merchant_balance NUMERIC;
  v_merchant_type TEXT;
  v_max_balance NUMERIC;
  v_ref TEXT;
  v_freeze_msg TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  IF p_client_id = p_merchant_id THEN
    RETURN json_build_object('success', false, 'message', 'Operasyon pa valab.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id IN (p_client_id, p_merchant_id) FOR UPDATE;

  v_freeze_msg := public.hatex_reject_if_card_frozen(p_client_id);
  IF v_freeze_msg IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', v_freeze_msg, 'card_frozen', true);
  END IF;

  SELECT account_status, COALESCE(card_balance, 0)
    INTO v_client_status, v_client_card_balance
  FROM public.profiles WHERE id = p_client_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kat kliyan an pa rekonèt.');
  END IF;

  IF v_client_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan an sispann.');
  END IF;

  IF v_client_status IS DISTINCT FROM 'active' THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan an pa aktif.');
  END IF;

  IF v_client_card_balance < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase fon sou kat ou a.');
  END IF;

  SELECT COALESCE(wallet_balance, 0), account_type
    INTO v_merchant_balance, v_merchant_type
  FROM public.profiles WHERE id = p_merchant_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Machann nan pa rekonèt.');
  END IF;

  v_max_balance := CASE WHEN v_merchant_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (v_merchant_balance + p_amount) > v_max_balance THEN
    RETURN json_build_object('success', false, 'message', 'Balans machann nan ta depase limit maksimòm otorize a.');
  END IF;

  v_ref := 'HPY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 9));

  UPDATE public.profiles SET card_balance = COALESCE(card_balance, 0) - p_amount WHERE id = p_client_id;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount WHERE id = p_merchant_id;

  INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id, metadata)
  VALUES (
    p_merchant_id, p_amount, 'SALE', 'success',
    'Vant Abònman: ' || p_plan_name || ' (Kliyan: ' || p_masked_name || ')',
    v_ref || '-M',
    jsonb_build_object('customer_name', p_masked_name, 'customer_email', p_client_email, 'plan_name', p_plan_name, 'payment_method', 'card')
  );

  INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id, metadata)
  VALUES (
    p_client_id, -p_amount, 'PAYMENT', 'success',
    'Peman Abònman: ' || p_plan_name || ' nan ' || p_shop_name,
    v_ref || '-C',
    jsonb_build_object('merchant_name', p_shop_name, 'plan_name', p_plan_name)
  );

  INSERT INTO public.subscriptions_history (merchant_id, client_id, client_email, client_name, shop_name, plan_name, amount, status)
  VALUES (p_merchant_id, p_client_id, p_client_email, p_masked_name, p_shop_name, p_plan_name, p_amount, 'success');

  RETURN json_build_object('success', true, 'reference', v_ref);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_subscription_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_subscription_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.process_subscription_payment(
  p_sub_id UUID,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_client_card NUMERIC;
  v_merchant_wallet NUMERIC;
  v_merchant_type TEXT;
  v_max NUMERIC;
  v_freeze_msg TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', 'Operasyon sa a pa otorize.');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  SELECT id, client_id, merchant_id, amount, plan_name, shop_name, status
    INTO v_sub
  FROM public.subscriptions WHERE id = p_sub_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Abònman pa jwenn.');
  END IF;
  IF v_sub.status NOT IN ('active', 'past_due') THEN
    RETURN json_build_object('success', false, 'message', 'Abònman pa aktif.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_sub.client_id FOR UPDATE;
  PERFORM 1 FROM public.profiles WHERE id = v_sub.merchant_id FOR UPDATE;

  v_freeze_msg := public.hatex_reject_if_card_frozen(v_sub.client_id);
  IF v_freeze_msg IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', v_freeze_msg, 'card_frozen', true);
  END IF;

  SELECT card_balance INTO v_client_card FROM public.profiles WHERE id = v_sub.client_id;
  IF COALESCE(v_client_card, 0) < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Balans kat kliyan an pa ase.');
  END IF;

  SELECT wallet_balance, account_type INTO v_merchant_wallet, v_merchant_type
  FROM public.profiles WHERE id = v_sub.merchant_id;

  v_max := CASE WHEN v_merchant_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_merchant_wallet, 0) + p_amount) > v_max THEN
    RETURN json_build_object('success', false, 'message', 'Balans machann nan ta depase limit maksimòm.');
  END IF;

  UPDATE public.profiles SET card_balance = card_balance - p_amount WHERE id = v_sub.client_id;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount WHERE id = v_sub.merchant_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (v_sub.client_id, 'SUBSCRIPTION', -p_amount, 'success', 'Abònman: ' || COALESCE(v_sub.plan_name, 'Plan'));

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (v_sub.merchant_id, 'SUBSCRIPTION', p_amount, 'success', 'Abònman resevwa: ' || COALESCE(v_sub.shop_name, 'Boutik'));

  RETURN json_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_subscription_payment(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_subscription_payment(UUID, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.process_merchant_payment_with_card(
  p_payment_id UUID,
  p_card_number TEXT,
  p_exp_date TEXT,
  p_cvv TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_buyer RECORD;
  v_merchant_balance NUMERIC;
  v_merchant_account_type TEXT;
  v_max_balance NUMERIC;
  v_freeze_msg TEXT;
BEGIN
  SELECT * INTO v_payment FROM public.payment_requests WHERE id = p_payment_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Fakti sa a pa egziste.'); END IF;
  IF v_payment.status = 'completed' THEN RETURN json_build_object('success', false, 'message', 'Fakti sa a te deja peye.'); END IF;

  SELECT * INTO v_buyer FROM public.profiles
  WHERE REPLACE(card_number, ' ', '') = REPLACE(p_card_number, ' ', '')
  AND exp_date = p_exp_date AND cvv = p_cvv;

  IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Enfòmasyon kat la pa bon.'); END IF;

  v_freeze_msg := public.hatex_reject_if_card_frozen(v_buyer.id);
  IF v_freeze_msg IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', v_freeze_msg, 'card_frozen', true);
  END IF;

  IF COALESCE(v_buyer.card_balance, 0) < v_payment.amount THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase lajan sou kat ou pou peman sa a.');
  END IF;

  SELECT wallet_balance, account_type INTO v_merchant_balance, v_merchant_account_type
  FROM public.profiles WHERE id = v_payment.merchant_id;

  v_max_balance := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_merchant_balance, 0) + v_payment.amount) > v_max_balance THEN
    RETURN json_build_object('success', false, 'message', 'Balans machann nan ta depase limit maksimòm otorize a (' || v_max_balance || ' HTG).');
  END IF;

  UPDATE public.profiles SET card_balance = card_balance - v_payment.amount WHERE id = v_buyer.id;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + v_payment.amount WHERE id = v_payment.merchant_id;

  UPDATE public.payment_requests SET status = 'completed' WHERE id = p_payment_id;

  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (v_buyer.id, -v_payment.amount, 'MERCHANT_PAYMENT', 'Acha anliy - Kòmand #' || v_payment.order_id, 'success');

  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (v_payment.merchant_id, v_payment.amount, 'MERCHANT_RECEIPT', 'Peman Plugin WooCommerce - Kòmand #' || v_payment.order_id, 'success');

  RETURN json_build_object('success', true, 'message', 'Peman an reyisi!');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_merchant_payment_with_card(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_merchant_payment_with_card(UUID, TEXT, TEXT, TEXT) TO service_role;
