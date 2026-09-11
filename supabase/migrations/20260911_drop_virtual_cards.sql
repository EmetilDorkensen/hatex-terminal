-- ============================================================================
-- HatexCard — Retire pwodwi "kat vityèl" nèt (kòd + baz done)
-- ============================================================================
-- Sa a retire SÈLMAN pwodwi kat vityèl HatexCard (balans kat, PAN/CVV, rechaj
-- kat, peman dirèk ak kat, kat friz). Rete entak: MonCash, fakti, plugin
-- WooCommerce, kont bank, KYC (dokiman idantite "kat" elektoral pa yon kolòn
-- isit la), wallet_balance, PIN.
-- ============================================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Trigger kat friz — dwe disparèt anvan fonksyon/kolòn yo
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prevent_frozen_card_debit ON public.profiles;

-- ------------------------------------------------------------
-- 2) Rekreye guard triggers profiles san referans kat
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := auth.jwt() ->> 'email';
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF v_email = 'adminhatexcard@gmail.com' THEN
    RETURN NEW;
  END IF;

  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE email = lower(v_email) AND status = 'active'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance
     OR NEW.agent_balance IS DISTINCT FROM OLD.agent_balance
     OR NEW.agent_capacity IS DISTINCT FROM OLD.agent_capacity
     OR NEW.agent_guarantee_paid IS DISTINCT FROM OLD.agent_guarantee_paid
     OR NEW.agent_status IS DISTINCT FROM OLD.agent_status
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.account_type IS DISTINCT FROM OLD.account_type
     OR NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     OR NEW.is_activated IS DISTINCT FROM OLD.is_activated
     OR NEW.is_merchant IS DISTINCT FROM OLD.is_merchant
     OR NEW.enterprise_status IS DISTINCT FROM OLD.enterprise_status
     OR NEW.enterprise_fee_paid IS DISTINCT FROM OLD.enterprise_fee_paid
     OR NEW.kyc_fee_paid IS DISTINCT FROM OLD.kyc_fee_paid
     OR NEW.features_unlock_paid IS DISTINCT FROM OLD.features_unlock_paid
     OR COALESCE(NEW.pin_code_hash, '') IS DISTINCT FROM COALESCE(OLD.pin_code_hash, '')
     OR COALESCE(NEW.transaction_pin_hash, '') IS DISTINCT FROM COALESCE(OLD.transaction_pin_hash, '')
     OR COALESCE(NEW.api_key, '') IS DISTINCT FROM COALESCE(OLD.api_key, '')
     OR COALESCE(NEW.api_key_hash, '') IS DISTINCT FROM COALESCE(OLD.api_key_hash, '')
     OR COALESCE(NEW.api_key_prefix, '') IS DISTINCT FROM COALESCE(OLD.api_key_prefix, '')
     OR COALESCE(NEW.api_key_pk, '') IS DISTINCT FROM COALESCE(OLD.api_key_pk, '')
     OR COALESCE(NEW.api_key_pk_hash, '') IS DISTINCT FROM COALESCE(OLD.api_key_pk_hash, '')
     OR COALESCE(NEW.api_key_pk_prefix, '') IS DISTINCT FROM COALESCE(OLD.api_key_pk_prefix, '')
     OR COALESCE(NEW.api_key_mode, '') IS DISTINCT FROM COALESCE(OLD.api_key_mode, '')
     OR COALESCE(NEW.webhook_secret, '') IS DISTINCT FROM COALESCE(OLD.webhook_secret, '')
     OR COALESCE(NEW.webhook_url, '') IS DISTINCT FROM COALESCE(OLD.webhook_url, '')
     OR COALESCE(NEW.agent_code, '') IS DISTINCT FROM COALESCE(OLD.agent_code, '')
     OR COALESCE(NEW.kyc_id_number_hash, '') IS DISTINCT FROM COALESCE(OLD.kyc_id_number_hash, '')
     OR COALESCE(NEW.current_session_token, '') IS DISTINCT FROM COALESCE(OLD.current_session_token, '')
  THEN
    RAISE EXCEPTION 'Chanjman sa a pa otorize dirèkteman. Sèvi ak operasyon ofisyèl sistèm nan.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  NEW.wallet_balance := 0;
  NEW.agent_balance := 0;
  NEW.agent_capacity := 0;
  NEW.agent_guarantee_paid := false;
  NEW.agent_status := 'none';
  NEW.account_status := 'active';
  NEW.account_type := COALESCE(NULLIF(NEW.account_type, ''), 'individual');
  NEW.kyc_status := 'not_submitted';
  NEW.is_activated := false;
  NEW.is_merchant := false;
  NEW.kyc_fee_paid := false;
  NEW.features_unlock_paid := false;
  NEW.enterprise_fee_paid := false;
  NEW.enterprise_status := 'none';

  NEW.pin_code_hash := NULL;
  NEW.transaction_pin_hash := NULL;
  NEW.api_key := NULL;
  NEW.api_key_hash := NULL;
  NEW.api_key_prefix := NULL;
  NEW.api_key_pk := NULL;
  NEW.api_key_pk_hash := NULL;
  NEW.api_key_pk_prefix := NULL;
  NEW.api_key_mode := 'live';
  NEW.webhook_secret := NULL;
  NEW.webhook_url := NULL;
  NEW.agent_code := NULL;
  NEW.kyc_id_number_hash := NULL;
  NEW.current_session_token := NULL;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_profile_sensitive_columns() IS
  'Bloke UPDATE finans/KYC/API/plugin/webhook depi navigatè (pa admin/staff). Kat vityèl retire.';
COMMENT ON FUNCTION public.guard_profile_sensitive_insert() IS
  'Fòse pwofil nouvo san balans/kle API/webhook/privilèj fo. Kat vityèl retire.';

-- ------------------------------------------------------------
-- 3) Motè ranbousman santral — sèlman wallet (pa kat ankò)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hatex_refund_credit_buyer(
  p_buyer_id UUID,
  p_amount NUMERIC,
  p_prefer TEXT DEFAULT 'wallet'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_buyer_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN 'none';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_buyer_id FOR UPDATE;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
  WHERE id = p_buyer_id;
  RETURN 'wallet';
END;
$$;

COMMENT ON FUNCTION public.hatex_refund_credit_buyer(UUID, NUMERIC, TEXT) IS
  'Kredite kliyan pou ranbousman — toujou sou wallet_balance (kat vityèl retire).';

-- process_hatex_refund: menm lojik ak 20260770, men sèlman 'wallet' kòm sib kredi.
CREATE OR REPLACE FUNCTION public.process_hatex_refund(
  p_source TEXT,
  p_source_id UUID,
  p_merchant_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC := 0;
  v_buyer_id UUID;
  v_buyer_email TEXT;
  v_prefer TEXT := 'wallet';
  v_credit TEXT := 'none';
  v_mbal NUMERIC;
  v_title TEXT := 'Ranbousman';
  v_tx_ref TEXT;
  v_booking RECORD;
  v_listing RECORD;
  v_sub RECORD;
  v_inv RECORD;
  v_plugin RECORD;
  v_pay RECORD;
  v_meta JSONB := '{}'::jsonb;
  v_has_booking BOOLEAN := false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  IF p_source IS NULL OR p_source_id IS NULL OR p_merchant_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Paramèt manke.');
  END IF;

  IF p_source NOT IN ('reservation', 'subscription', 'invoice', 'plugin', 'payment_request') THEN
    RETURN json_build_object('success', false, 'message', 'Sous ranbousman pa valab.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.hatex_refunds WHERE source = p_source AND source_id = p_source_id
  ) THEN
    RETURN json_build_object('success', false, 'message', 'Deja ranbouse.');
  END IF;

  -- ---------- Resolve amount + parties by source ----------
  IF p_source = 'reservation' THEN
    SELECT * INTO v_booking
    FROM public.reservation_bookings
    WHERE id = p_source_id AND merchant_id = p_merchant_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'message', 'Rezèvasyon pa jwenn.');
    END IF;
    IF v_booking.status = 'refunded' THEN
      RETURN json_build_object('success', false, 'message', 'Deja ranbouse.');
    END IF;
    IF v_booking.status <> 'paid' THEN
      RETURN json_build_object('success', false, 'message', 'Sèlman peman konfime yo ka ranbouse.');
    END IF;
    v_amount := v_booking.amount;
    v_buyer_id := v_booking.buyer_id;
    v_prefer := 'wallet';
    SELECT title INTO v_title FROM public.reservation_listings WHERE id = v_booking.listing_id;
    v_title := COALESCE(v_title, 'Rezèvasyon');
    v_meta := jsonb_build_object('booking_id', v_booking.id, 'listing_id', v_booking.listing_id);
    v_has_booking := true;

  ELSIF p_source = 'subscription' THEN
    SELECT * INTO v_sub
    FROM public.reservation_subscriptions
    WHERE id = p_source_id AND merchant_id = p_merchant_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'message', 'Abònman pa jwenn.');
    END IF;
    IF v_sub.last_booking_id IS NOT NULL THEN
      SELECT * INTO v_booking
      FROM public.reservation_bookings
      WHERE id = v_sub.last_booking_id AND merchant_id = p_merchant_id
      FOR UPDATE;
      IF FOUND AND v_booking.status = 'paid' THEN
        v_amount := v_booking.amount;
        v_has_booking := true;
      ELSE
        v_amount := v_sub.amount;
      END IF;
    ELSE
      v_amount := v_sub.amount;
    END IF;
    v_prefer := 'wallet';
    v_buyer_id := v_sub.buyer_id;
    SELECT title INTO v_title FROM public.reservation_listings WHERE id = v_sub.listing_id;
    v_title := COALESCE(v_title, 'Abònman');
    v_meta := jsonb_build_object('subscription_id', v_sub.id, 'listing_id', v_sub.listing_id);

  ELSIF p_source = 'invoice' THEN
    SELECT * INTO v_inv
    FROM public.invoices
    WHERE id = p_source_id AND owner_id = p_merchant_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'message', 'Fakti pa jwenn.');
    END IF;
    IF v_inv.status = 'refunded' THEN
      RETURN json_build_object('success', false, 'message', 'Deja ranbouse.');
    END IF;
    IF v_inv.status <> 'paid' THEN
      RETURN json_build_object('success', false, 'message', 'Sèlman fakti peye yo ka ranbouse.');
    END IF;
    v_amount := v_inv.amount;
    v_buyer_email := lower(COALESCE(v_inv.client_email, ''));
    IF v_buyer_email <> '' THEN
      SELECT id INTO v_buyer_id FROM public.profiles WHERE lower(email) = v_buyer_email LIMIT 1;
    END IF;
    v_prefer := 'wallet';
    v_title := COALESCE(NULLIF(v_inv.description, ''), 'Fakti');
    v_meta := jsonb_build_object('invoice_id', v_inv.id, 'client_email', v_inv.client_email);

  ELSIF p_source = 'plugin' THEN
    SELECT * INTO v_plugin
    FROM public.plugin_transactions
    WHERE id = p_source_id AND merchant_id = p_merchant_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'message', 'Tranzaksyon plugin pa jwenn.');
    END IF;
    IF v_plugin.status = 'refunded' THEN
      RETURN json_build_object('success', false, 'message', 'Deja ranbouse.');
    END IF;
    v_amount := COALESCE(v_plugin.amount_htg, 0);
    v_buyer_email := lower(COALESCE(v_plugin.customer_info->>'email', ''));
    IF v_buyer_email <> '' THEN
      SELECT id INTO v_buyer_id FROM public.profiles WHERE lower(email) = v_buyer_email LIMIT 1;
    END IF;
    v_prefer := 'wallet';
    v_title := 'Kòmand #' || COALESCE(v_plugin.order_id::text, 'N/A');
    v_meta := jsonb_build_object('plugin_tx_id', v_plugin.id, 'order_id', v_plugin.order_id);

  ELSIF p_source = 'payment_request' THEN
    SELECT * INTO v_pay
    FROM public.payment_requests
    WHERE id = p_source_id AND merchant_id = p_merchant_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'message', 'Peman pa jwenn.');
    END IF;
    IF v_pay.status = 'refunded' THEN
      RETURN json_build_object('success', false, 'message', 'Deja ranbouse.');
    END IF;
    IF v_pay.status IS DISTINCT FROM 'completed' THEN
      RETURN json_build_object('success', false, 'message', 'Sèlman peman konplete yo ka ranbouse.');
    END IF;
    v_amount := COALESCE(v_pay.amount, 0);
    SELECT t.user_id INTO v_buyer_id
    FROM public.transactions t
    WHERE t.type IN ('MERCHANT_PAYMENT', 'PURCHASE')
      AND t.amount < 0
      AND (
        t.description ILIKE '%' || COALESCE(v_pay.order_id::text, '') || '%'
        OR (t.metadata->>'payment_request_id') = p_source_id::text
      )
    ORDER BY t.created_at DESC
    LIMIT 1;
    v_prefer := 'wallet';
    v_title := 'Peman #' || COALESCE(v_pay.order_id::text, p_source_id::text);
    v_meta := jsonb_build_object('payment_request_id', v_pay.id, 'order_id', v_pay.order_id);
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan ranbousman pa valab.');
  END IF;

  -- Lock merchant + debit wallet
  SELECT wallet_balance INTO v_mbal FROM public.profiles WHERE id = p_merchant_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Machann pa jwenn.');
  END IF;
  IF COALESCE(v_mbal, 0) < v_amount THEN
    RETURN json_build_object(
      'success', false,
      'message',
      'Balans wallet machann ensifizan pou ranbouse (' || v_amount || ' HTG). Rechaje wallet ou.'
    );
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) - v_amount
  WHERE id = p_merchant_id;

  IF v_buyer_id IS NOT NULL THEN
    v_credit := public.hatex_refund_credit_buyer(v_buyer_id, v_amount, v_prefer);
  END IF;

  v_tx_ref := 'RFD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
  VALUES (
    p_merchant_id, -v_amount, 'REFUND_OUT',
    'Ranbousman: ' || v_title,
    'success', v_tx_ref || '-M',
    jsonb_build_object('source', p_source, 'source_id', p_source_id, 'reason', COALESCE(p_reason, ''))
  );

  IF v_buyer_id IS NOT NULL THEN
    INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
    VALUES (
      v_buyer_id, v_amount, 'REFUND_IN',
      'Ranbousman resevwa: ' || v_title,
      'success', v_tx_ref || '-C',
      jsonb_build_object('source', p_source, 'source_id', p_source_id, 'credit_target', v_credit)
    );
  END IF;

  -- Mark source rows
  IF p_source = 'reservation' THEN
    UPDATE public.reservation_bookings
    SET status = 'refunded', updated_at = now()
    WHERE id = p_source_id;
    UPDATE public.reservation_subscriptions
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE last_booking_id = p_source_id AND status IN ('active', 'past_due');

  ELSIF p_source = 'subscription' THEN
    UPDATE public.reservation_subscriptions
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE id = p_source_id;
    IF v_has_booking AND v_booking.status = 'paid' THEN
      UPDATE public.reservation_bookings
      SET status = 'refunded', updated_at = now()
      WHERE id = v_booking.id;
    END IF;

  ELSIF p_source = 'invoice' THEN
    UPDATE public.invoices SET status = 'refunded' WHERE id = p_source_id;

  ELSIF p_source = 'plugin' THEN
    UPDATE public.plugin_transactions
    SET status = 'refunded',
        refund_reason = COALESCE(p_reason, 'Kliyan an mande ranbousman'),
        refunded_at = now()
    WHERE id = p_source_id;

  ELSIF p_source = 'payment_request' THEN
    BEGIN
      UPDATE public.payment_requests SET status = 'refunded' WHERE id = p_source_id;
    EXCEPTION WHEN check_violation OR others THEN
      NULL;
    END;
  END IF;

  INSERT INTO public.hatex_refunds (
    source, source_id, merchant_id, buyer_id, amount, credit_target, reason, metadata
  ) VALUES (
    p_source, p_source_id, p_merchant_id, v_buyer_id, v_amount, v_credit,
    COALESCE(p_reason, 'Ranbousman'),
    v_meta || jsonb_build_object('tx_ref', v_tx_ref, 'title', v_title)
  );

  IF v_buyer_id IS NOT NULL THEN
    SELECT email INTO v_buyer_email FROM public.profiles WHERE id = v_buyer_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Ranbousman an pase.',
    'refunded', v_amount,
    'credit_target', v_credit,
    'buyer_id', v_buyer_id,
    'buyer_email', v_buyer_email,
    'reference_id', v_tx_ref,
    'title', v_title,
    'source', p_source,
    'source_id', p_source_id
  );
END;
$$;

COMMENT ON FUNCTION public.process_hatex_refund(TEXT, UUID, UUID, TEXT) IS
  'Motè ranbousman santral — kredi toujou sou wallet_balance (kat vityèl retire).';

-- ------------------------------------------------------------
-- 4) Rezèvasyon/abònman (fonksyonalite san UI): retire opsyon 'card'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_reservation_payment(
  p_booking_id UUID,
  p_buyer_id UUID,
  p_payment_method TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_listing RECORD;
  v_buyer RECORD;
  v_merchant_balance NUMERIC;
  v_merchant_account_type TEXT;
  v_max_balance NUMERIC;
  v_tx_ref TEXT;
  v_buyer_tx_id UUID;
  v_merchant_tx_id UUID;
  v_snapshot JSONB;
  v_merchant_row RECORD;
  v_interval_days INTEGER;
  v_sub_id UUID;
BEGIN
  IF p_payment_method IS NULL OR p_payment_method <> 'wallet' THEN
    RETURN json_build_object('success', false, 'message', 'Metòd peman pa valab.');
  END IF;

  SELECT * INTO v_booking FROM public.reservation_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Rezèvasyon pa jwenn.');
  END IF;
  IF v_booking.status = 'paid' THEN
    RETURN json_build_object('success', false, 'message', 'Rezèvasyon sa a te deja peye.');
  END IF;
  IF v_booking.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Rezèvasyon pa disponib pou peman.');
  END IF;

  SELECT * INTO v_listing FROM public.reservation_listings WHERE id = v_booking.listing_id;
  IF NOT FOUND OR v_listing.is_active IS NOT TRUE THEN
    RETURN json_build_object('success', false, 'message', 'Ofri a pa disponib ankò.');
  END IF;

  IF p_buyer_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Kliyan pa idantifye.');
  END IF;
  IF p_buyer_id = v_booking.merchant_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa ka peye pwòp ofri ou.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id IN (p_buyer_id, v_booking.merchant_id) FOR UPDATE;

  SELECT id, full_name, email, wallet_balance, account_status, account_type
  INTO v_buyer FROM public.profiles WHERE id = p_buyer_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan pa jwenn.');
  END IF;
  IF v_buyer.account_status IS DISTINCT FROM 'active' THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan an pa aktif.');
  END IF;

  IF COALESCE(v_buyer.wallet_balance, 0) < v_booking.amount THEN
    RETURN json_build_object('success', false, 'message', 'Fon ensifizan');
  END IF;

  SELECT wallet_balance, account_type
  INTO v_merchant_balance, v_merchant_account_type
  FROM public.profiles WHERE id = v_booking.merchant_id;

  v_max_balance := CASE
    WHEN v_merchant_account_type = 'business' THEN public.hatex_resolve_limit('enterprise_max_wallet', 12000000)
    ELSE public.hatex_resolve_limit('individual_max_wallet', 1200000)
  END;
  IF (COALESCE(v_merchant_balance, 0) + v_booking.amount) > v_max_balance THEN
    RETURN json_build_object(
      'success', false,
      'message',
      'Balans machann nan ta depase limit maksimòm otorize a (' || v_max_balance || ' HTG).'
    );
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - v_booking.amount WHERE id = p_buyer_id;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_booking.amount
  WHERE id = v_booking.merchant_id;

  v_tx_ref := 'RSV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  SELECT * INTO v_merchant_row FROM public.reservation_merchants WHERE user_id = v_booking.merchant_id;

  v_snapshot := jsonb_build_object(
    'listing_id', v_listing.id,
    'listing_title', v_listing.title,
    'listing_photos', to_jsonb(v_listing.photos),
    'category', v_listing.category,
    'unit_price', v_booking.unit_price,
    'delivery_fee', v_booking.delivery_fee,
    'delivery_requested', v_booking.delivery_requested,
    'amount', v_booking.amount,
    'scheduled_at', v_booking.scheduled_at,
    'scheduled_end', v_booking.scheduled_end,
    'nights_or_days', v_booking.nights_or_days,
    'buyer_name', v_buyer.full_name,
    'buyer_email', v_buyer.email,
    'merchant_name', COALESCE(v_merchant_row.business_name, (SELECT full_name FROM public.profiles WHERE id = v_booking.merchant_id)),
    'business_name', COALESCE(v_merchant_row.business_name, ''),
    'logo_url', v_merchant_row.logo_url,
    'merchant_phone', COALESCE(v_listing.phone, v_merchant_row.phone),
    'merchant_whatsapp', v_merchant_row.whatsapp,
    'merchant_address', COALESCE(v_listing.address, v_merchant_row.address),
    'listing_phone', v_listing.phone,
    'reference_id', v_tx_ref
  );

  INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
  VALUES (
    p_buyer_id, -v_booking.amount, 'RESERVATION_PAYMENT',
    'Rezèvasyon: ' || v_listing.title,
    'success', v_tx_ref || '-C',
    jsonb_build_object(
      'source', 'reservation',
      'booking_id', p_booking_id,
      'payment_method', p_payment_method,
      'category', v_listing.category
    )
  )
  RETURNING id INTO v_buyer_tx_id;

  INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
  VALUES (
    v_booking.merchant_id, v_booking.amount, 'RESERVATION_RECEIPT',
    'Lavant rezèvasyon: ' || v_listing.title,
    'success', v_tx_ref || '-M',
    jsonb_build_object(
      'source', 'reservation',
      'booking_id', p_booking_id,
      'payment_method', p_payment_method,
      'category', v_listing.category
    )
  )
  RETURNING id INTO v_merchant_tx_id;

  UPDATE public.reservation_bookings SET
    status = 'paid',
    buyer_id = p_buyer_id,
    payment_method = p_payment_method,
    buyer_tx_id = v_buyer_tx_id,
    merchant_tx_id = v_merchant_tx_id,
    reference_id = v_tx_ref,
    receipt_snapshot = v_snapshot,
    paid_at = now(),
    updated_at = now()
  WHERE id = p_booking_id;

  IF v_listing.category = 'subscription' THEN
    v_interval_days := COALESCE(NULLIF((v_listing.meta->>'billing_interval_days')::int, 0), 30);
    INSERT INTO public.reservation_subscriptions (
      listing_id, merchant_id, buyer_id, amount, billing_interval_days,
      status, next_billing_date, last_booking_id
    ) VALUES (
      v_listing.id, v_booking.merchant_id, p_buyer_id, v_booking.amount, v_interval_days,
      'active', now() + make_interval(days => v_interval_days), p_booking_id
    )
    RETURNING id INTO v_sub_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Peman rezèvasyon reyisi!',
    'booking_id', p_booking_id,
    'transaction_id', v_buyer_tx_id,
    'merchant_tx_id', v_merchant_tx_id,
    'reference_id', v_tx_ref,
    'subscription_id', v_sub_id
  );
END;
$$;

COMMENT ON FUNCTION public.process_reservation_payment(UUID, UUID, TEXT) IS
  'Peman rezèvasyon/abònman — sèlman wallet_balance (kat vityèl retire).';

CREATE OR REPLACE FUNCTION public.process_reservation_subscription_renewal(
  p_subscription_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_listing RECORD;
  v_buyer RECORD;
  v_booking_id UUID;
  v_pay JSON;
BEGIN
  SELECT * INTO v_sub FROM public.reservation_subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Abònman pa jwenn.');
  END IF;
  IF v_sub.status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'message', 'Abònman anile.');
  END IF;

  SELECT * INTO v_listing FROM public.reservation_listings WHERE id = v_sub.listing_id;
  IF NOT FOUND OR v_listing.is_active IS NOT TRUE THEN
    UPDATE public.reservation_subscriptions SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE id = p_subscription_id;
    RETURN json_build_object('success', false, 'message', 'Ofri abònman pa aktif.');
  END IF;

  SELECT id, wallet_balance INTO v_buyer FROM public.profiles WHERE id = v_sub.buyer_id FOR UPDATE;
  IF NOT FOUND OR COALESCE(v_buyer.wallet_balance, 0) < v_sub.amount THEN
    IF v_sub.status = 'active' THEN
      UPDATE public.reservation_subscriptions SET status = 'past_due', updated_at = now() WHERE id = p_subscription_id;
      RETURN json_build_object('success', false, 'message', 'Fon ensifizan', 'past_due', true);
    ELSE
      UPDATE public.reservation_subscriptions
      SET status = 'cancelled', cancelled_at = now(), updated_at = now()
      WHERE id = p_subscription_id;
      RETURN json_build_object('success', false, 'message', 'Abònman anile apre echèk peman.', 'cancelled', true);
    END IF;
  END IF;

  INSERT INTO public.reservation_bookings (
    listing_id, merchant_id, buyer_id, scheduled_at, unit_price, amount, status, quantity
  ) VALUES (
    v_sub.listing_id, v_sub.merchant_id, v_sub.buyer_id, now(), v_sub.amount, v_sub.amount, 'pending', 1
  )
  RETURNING id INTO v_booking_id;

  v_pay := public.process_reservation_payment(v_booking_id, v_sub.buyer_id, 'wallet');
  IF COALESCE((v_pay->>'success')::boolean, false) IS NOT TRUE THEN
    RETURN v_pay;
  END IF;

  UPDATE public.reservation_subscriptions SET
    status = 'active',
    next_billing_date = now() + make_interval(days => v_sub.billing_interval_days),
    last_booking_id = v_booking_id,
    updated_at = now()
  WHERE id = p_subscription_id;

  RETURN json_build_object('success', true, 'booking_id', v_booking_id, 'subscription_id', p_subscription_id);
END;
$$;

COMMENT ON FUNCTION public.process_reservation_subscription_renewal(UUID) IS
  'Renouvèlman abònman rezèvasyon — sèlman wallet_balance (kat vityèl retire).';

-- ------------------------------------------------------------
-- 5) Drop tout RPC ki te sèvi sèlman pou pwodwi kat vityèl la
--    (dinamik pou kenbe TOUT overload, kèlkeswa siyati egzat)
-- ------------------------------------------------------------
DO $$
DECLARE
  fn TEXT;
  r RECORD;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'process_card_recharge',
    'process_direct_card_payment',
    'process_invoice_card_payment',
    'process_subscription_card_payment',
    'process_merchant_payment_with_card',
    'set_card_frozen',
    'hatex_reject_if_card_frozen',
    'hatex_prevent_frozen_card_debit',
    'transfer_wallet_to_card',
    'process_card_activation',
    'recharge_card',
    'recharge_card_internal',
    'generate_hatex_card',
    'activate_user_card_and_api',
    'pay_invoice_via_card',
    'process_features_unlock_fee'
  ]
  LOOP
    FOR r IN
      SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig);
    END LOOP;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 6) Retire kolòn kat vityèl la sou profiles
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS card_number,
  DROP COLUMN IF EXISTS cvv,
  DROP COLUMN IF EXISTS card_number_hash,
  DROP COLUMN IF EXISTS cvv_hash,
  DROP COLUMN IF EXISTS card_last4,
  DROP COLUMN IF EXISTS card_balance,
  DROP COLUMN IF EXISTS is_card_activated,
  DROP COLUMN IF EXISTS is_card_frozen,
  DROP COLUMN IF EXISTS exp_date,
  DROP COLUMN IF EXISTS card_expiry,
  DROP COLUMN IF EXISTS card_cvv,
  DROP COLUMN IF EXISTS card_holder,
  DROP COLUMN IF EXISTS card_active;

-- ------------------------------------------------------------
-- 7) Retire paramèt limit / frè kat vityèl la
-- ------------------------------------------------------------
DELETE FROM public.platform_limit_settings
WHERE limit_key IN ('card_recharge_max', 'enterprise_card_daily_limit', 'enterprise_card_monthly_limit');

DO $$
BEGIN
  IF to_regclass('public.platform_fee_settings') IS NOT NULL THEN
    DELETE FROM public.platform_fee_settings WHERE fee_key = 'card_activation_fee';
  END IF;
END $$;

COMMIT;
