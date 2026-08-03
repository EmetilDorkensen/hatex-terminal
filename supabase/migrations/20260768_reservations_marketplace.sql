-- ============================================================
-- HatexCard — Espas Rezèvasyon (marketplace)
-- Tables + RLS + storage + process_reservation_payment RPC
-- ============================================================

-- ---------- Tables ----------

CREATE TABLE IF NOT EXISTS public.reservation_merchants (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  whatsapp TEXT NOT NULL,
  email TEXT,
  zone TEXT,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reservation_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'hotel_room', 'restaurant_dish', 'bar', 'car_rental', 'subscription'
  )),
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL CHECK (price > 0),
  zone TEXT,
  address TEXT,
  phone TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_listings_active
  ON public.reservation_listings (is_active, category, zone);
CREATE INDEX IF NOT EXISTS idx_reservation_listings_merchant
  ON public.reservation_listings (merchant_id);

CREATE TABLE IF NOT EXISTS public.reservation_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.reservation_listings(id) ON DELETE RESTRICT,
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  nights_or_days INTEGER DEFAULT 1,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  delivery_requested BOOLEAN NOT NULL DEFAULT false,
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_address TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  payment_method TEXT CHECK (payment_method IN ('wallet', 'card')),
  buyer_tx_id UUID,
  merchant_tx_id UUID,
  reference_id TEXT,
  receipt_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_bookings_buyer ON public.reservation_bookings (buyer_id);
CREATE INDEX IF NOT EXISTS idx_reservation_bookings_merchant ON public.reservation_bookings (merchant_id);
CREATE INDEX IF NOT EXISTS idx_reservation_bookings_status ON public.reservation_bookings (status);

-- Abònman ki soti nan marketplace (kat obligatwa)
CREATE TABLE IF NOT EXISTS public.reservation_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.reservation_listings(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  billing_interval_days INTEGER NOT NULL DEFAULT 30 CHECK (billing_interval_days > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled')),
  next_billing_date TIMESTAMPTZ NOT NULL,
  last_booking_id UUID REFERENCES public.reservation_bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reservation_subs_due
  ON public.reservation_subscriptions (status, next_billing_date);

-- ---------- Storage bucket ----------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reservation-media',
  'reservation-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "reservation_media_insert" ON storage.objects;
CREATE POLICY "reservation_media_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reservation-media'
  AND name LIKE (auth.uid()::text || '/%')
);

DROP POLICY IF EXISTS "reservation_media_select" ON storage.objects;
CREATE POLICY "reservation_media_select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'reservation-media');

DROP POLICY IF EXISTS "reservation_media_update" ON storage.objects;
CREATE POLICY "reservation_media_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'reservation-media' AND name LIKE (auth.uid()::text || '/%'))
WITH CHECK (bucket_id = 'reservation-media' AND name LIKE (auth.uid()::text || '/%'));

DROP POLICY IF EXISTS "reservation_media_delete" ON storage.objects;
CREATE POLICY "reservation_media_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reservation-media' AND name LIKE (auth.uid()::text || '/%'));

-- ---------- RLS ----------

ALTER TABLE public.reservation_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rm_select_public ON public.reservation_merchants;
CREATE POLICY rm_select_public ON public.reservation_merchants
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS rm_upsert_own ON public.reservation_merchants;
CREATE POLICY rm_upsert_own ON public.reservation_merchants
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS rl_select_active ON public.reservation_listings;
CREATE POLICY rl_select_active ON public.reservation_listings
  FOR SELECT TO authenticated, anon
  USING (is_active = true OR merchant_id = auth.uid());

DROP POLICY IF EXISTS rl_merchant_write ON public.reservation_listings;
CREATE POLICY rl_merchant_write ON public.reservation_listings
  FOR ALL TO authenticated
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS rb_select_parties ON public.reservation_bookings;
CREATE POLICY rb_select_parties ON public.reservation_bookings
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR merchant_id = auth.uid());

DROP POLICY IF EXISTS rb_insert_buyer ON public.reservation_bookings;
CREATE POLICY rb_insert_buyer ON public.reservation_bookings
  FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS rb_update_buyer_pending ON public.reservation_bookings;
CREATE POLICY rb_update_buyer_pending ON public.reservation_bookings
  FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() AND status = 'pending')
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS rs_select_parties ON public.reservation_subscriptions;
CREATE POLICY rs_select_parties ON public.reservation_subscriptions
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR merchant_id = auth.uid());

DROP POLICY IF EXISTS rs_cancel_buyer ON public.reservation_subscriptions;
CREATE POLICY rs_cancel_buyer ON public.reservation_subscriptions
  FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

-- ---------- RPC: process_reservation_payment ----------
-- p_payment_method: 'wallet' | 'card'
-- Pou wallet: p_buyer_id obligatwa (sesyon verifye nan API).
-- Pou card: p_buyer_id soti nan findProfileByCard nan API (pase id).

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

  -- Abònman: kat sèlman
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

  -- Premye peman abònman → kreye subscription aktif
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

REVOKE EXECUTE ON FUNCTION public.process_reservation_payment(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_reservation_payment(UUID, UUID, TEXT)
  TO service_role;

-- ---------- RPC: renew reservation subscription (cron) ----------

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

  SELECT id, card_balance INTO v_buyer FROM public.profiles WHERE id = v_sub.buyer_id FOR UPDATE;
  IF NOT FOUND OR COALESCE(v_buyer.card_balance, 0) < v_sub.amount THEN
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

  v_pay := public.process_reservation_payment(v_booking_id, v_sub.buyer_id, 'card');
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

REVOKE EXECUTE ON FUNCTION public.process_reservation_subscription_renewal(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_reservation_subscription_renewal(UUID)
  TO service_role;
