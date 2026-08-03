-- Patch: abònman labels + richer receipt snapshot (description, billing, car)
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
  v_freeze_msg TEXT;
  v_tx_ref TEXT;
  v_buyer_tx_id UUID;
  v_merchant_tx_id UUID;
  v_snapshot JSONB;
  v_merchant_row RECORD;
  v_interval_days INTEGER;
  v_sub_id UUID;
  v_buyer_label TEXT;
  v_merchant_label TEXT;
BEGIN
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('wallet', 'card') THEN
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

  IF v_listing.category = 'subscription' AND p_payment_method <> 'card' THEN
    RETURN json_build_object('success', false, 'message', 'Abònman yo dwe peye ak kat HatexCard.');
  END IF;

  IF p_buyer_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Kliyan pa idantifye.');
  END IF;
  IF p_buyer_id = v_booking.merchant_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa ka peye pwòp ofri ou.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id IN (p_buyer_id, v_booking.merchant_id) FOR UPDATE;

  v_freeze_msg := public.hatex_reject_if_card_frozen(p_buyer_id);
  IF v_freeze_msg IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', v_freeze_msg, 'card_frozen', true);
  END IF;

  SELECT id, full_name, email, wallet_balance, card_balance, account_status, account_type
  INTO v_buyer FROM public.profiles WHERE id = p_buyer_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan pa jwenn.');
  END IF;
  IF v_buyer.account_status IS DISTINCT FROM 'active' THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan an pa aktif.');
  END IF;

  IF p_payment_method = 'wallet' THEN
    IF COALESCE(v_buyer.wallet_balance, 0) < v_booking.amount THEN
      RETURN json_build_object('success', false, 'message', 'Fon ensifizan');
    END IF;
  ELSE
    IF COALESCE(v_buyer.card_balance, 0) < v_booking.amount THEN
      RETURN json_build_object('success', false, 'message', 'Fon ensifizan');
    END IF;
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

  IF p_payment_method = 'wallet' THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance - v_booking.amount WHERE id = p_buyer_id;
  ELSE
    UPDATE public.profiles SET card_balance = card_balance - v_booking.amount WHERE id = p_buyer_id;
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_booking.amount
  WHERE id = v_booking.merchant_id;

  v_tx_ref := 'RSV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  SELECT * INTO v_merchant_row FROM public.reservation_merchants WHERE user_id = v_booking.merchant_id;

  v_snapshot := jsonb_build_object(
    'listing_id', v_listing.id,
    'listing_title', v_listing.title,
    'listing_description', v_listing.description,
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
    'billing_interval_days', COALESCE(NULLIF((v_listing.meta->>'billing_interval_days')::int, 0), NULL),
    'car_make', v_listing.meta->>'car_make',
    'car_year', v_listing.meta->>'car_year',
    'reference_id', v_tx_ref
  );

  IF v_listing.category = 'subscription' THEN
    v_buyer_label := 'Abònman: ' || v_listing.title;
    v_merchant_label := 'Lavant abònman: ' || v_listing.title;
  ELSE
    v_buyer_label := 'Rezèvasyon: ' || v_listing.title;
    v_merchant_label := 'Lavant rezèvasyon: ' || v_listing.title;
  END IF;

  INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
  VALUES (
    p_buyer_id, -v_booking.amount, 'RESERVATION_PAYMENT',
    v_buyer_label,
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
    v_merchant_label,
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
    'message', CASE WHEN v_listing.category = 'subscription' THEN 'Peman abònman reyisi!' ELSE 'Peman rezèvasyon reyisi!' END,
    'booking_id', p_booking_id,
    'transaction_id', v_buyer_tx_id,
    'merchant_tx_id', v_merchant_tx_id,
    'reference_id', v_tx_ref,
    'subscription_id', v_sub_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_reservation_payment(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_reservation_payment(UUID, UUID, TEXT)
  TO service_role;
