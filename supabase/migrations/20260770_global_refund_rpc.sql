-- ============================================================
-- Global HatexCard refund engine (yon sèl RPC pou tout sous)
-- ============================================================

-- Ledger anti-double-refund
CREATE TABLE IF NOT EXISTS public.hatex_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN (
    'reservation', 'subscription', 'invoice', 'plugin', 'payment_request'
  )),
  source_id UUID NOT NULL,
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  credit_target TEXT CHECK (credit_target IN ('wallet', 'card', 'none')),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_hatex_refunds_merchant ON public.hatex_refunds (merchant_id, created_at DESC);

ALTER TABLE public.hatex_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hatex_refunds_select_parties ON public.hatex_refunds;
CREATE POLICY hatex_refunds_select_parties ON public.hatex_refunds
  FOR SELECT TO authenticated
  USING (merchant_id = auth.uid() OR buyer_id = auth.uid());

-- reservation_bookings: allow refunded
DO $$
BEGIN
  ALTER TABLE public.reservation_bookings DROP CONSTRAINT IF EXISTS reservation_bookings_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.reservation_bookings
  ADD CONSTRAINT reservation_bookings_status_check
  CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded'));

-- invoices: allow refunded
DO $$
BEGIN
  ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('pending', 'paid', 'cancelled', 'expired', 'refunded'));

-- Helper: credit buyer (cap-exempt — retounen pwòp kob yo)
CREATE OR REPLACE FUNCTION public.hatex_refund_credit_buyer(
  p_buyer_id UUID,
  p_amount NUMERIC,
  p_prefer TEXT DEFAULT 'card'
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

  IF p_prefer = 'wallet' THEN
    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
    WHERE id = p_buyer_id;
    RETURN 'wallet';
  END IF;

  UPDATE public.profiles
  SET card_balance = COALESCE(card_balance, 0) + p_amount
  WHERE id = p_buyer_id;
  RETURN 'card';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_refund_credit_buyer(UUID, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hatex_refund_credit_buyer(UUID, NUMERIC, TEXT)
  TO service_role;

-- ============================================================
-- CENTRAL RPC
-- ============================================================
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
  v_prefer TEXT := 'card';
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
    v_prefer := CASE WHEN v_booking.payment_method = 'wallet' THEN 'wallet' ELSE 'card' END;
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
        v_prefer := CASE WHEN v_booking.payment_method = 'wallet' THEN 'wallet' ELSE 'card' END;
        v_has_booking := true;
      ELSE
        v_amount := v_sub.amount;
        v_prefer := 'card';
      END IF;
    ELSE
      v_amount := v_sub.amount;
      v_prefer := 'card';
    END IF;
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
    v_prefer := 'card';
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
    v_prefer := 'card';
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
    -- Chèche buyer nan transactions MERCHANT_PAYMENT ak description order
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
    v_prefer := 'card';
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
    -- Anile abònman ki te soti nan booking sa si genyen
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
      -- Si status CHECK pa pèmèt refunded, kite completed + ledger sèlman
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

REVOKE EXECUTE ON FUNCTION public.process_hatex_refund(TEXT, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_hatex_refund(TEXT, UUID, UUID, TEXT)
  TO service_role;

-- Plugin path → santral
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
BEGIN
  RETURN public.process_hatex_refund('plugin', p_transaction_id, p_merchant_id, p_reason);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_plugin_refund(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_plugin_refund(UUID, UUID, TEXT)
  TO service_role;
