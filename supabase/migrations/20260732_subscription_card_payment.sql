-- ============================================================================
-- RPC ATOMIK: peman abònman ak kat — ranplase .update() bò kliyan an
-- ============================================================================
-- Anvan sa, `app/subscribe/[id]/page.tsx` te fè:
--   1. verify-card (bay balans/PII bay navigatè a),
--   2. kalkile nouvo balans NAN NAVIGATÈ a,
--   3. de `.update({ card_balance })` / `.update({ wallet_balance })` separe,
--   4. `.insert()` tranzaksyon yo.
-- Tout etap sa yo te ka manipile depi devtools (double-spend, chanje montan,
-- kredite tèt ou). Kounye a yon sèl fonksyon fè tout bagay ATOMIKMAN sou sèvè.
--
-- Sèvè a (route /api/subscribe/pay) verifye kat la AVAN, epi li pase client_id
-- ak merchant_id ki fè konfyans. Fonksyon an re-verifye balans/estati/plafon
-- ANNDAN yon sèl tranzaksyon SQL ak FOR UPDATE.
-- ============================================================================

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
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  IF p_client_id = p_merchant_id THEN
    RETURN json_build_object('success', false, 'message', 'Operasyon pa valab.');
  END IF;

  -- Bloke tou de ranje yo (nan lòd ID pou evite deadlock) pou evite double-spend
  PERFORM 1 FROM public.profiles WHERE id IN (p_client_id, p_merchant_id) FOR UPDATE;

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

  -- Mouvman balans
  UPDATE public.profiles SET card_balance = COALESCE(card_balance, 0) - p_amount WHERE id = p_client_id;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount WHERE id = p_merchant_id;

  -- Istorik machann (antre) + kliyan (soti)
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

-- Sèlman sèvè a (service_role) ka rele fonksyon sa a — pa kliyan navigatè.
REVOKE EXECUTE ON FUNCTION public.process_subscription_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_subscription_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM authenticated;

-- ============================================================================
-- APRE: kouri nan Supabase > SQL Editor. Route /api/subscribe/pay rele l ak
-- service role (li kontounen REVOKE la, sa nòmal).
-- ============================================================================
