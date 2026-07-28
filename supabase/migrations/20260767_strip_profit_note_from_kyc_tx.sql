-- ============================================================
-- Retire « — pwofi HatexCard » nan mesaj tranzaksyon KYC / debloke
-- (kliyan pa bezwen wè nòt entèn pwofi)
-- ============================================================

-- Netwaye ansyen liy
UPDATE public.transactions
SET description = trim(
  regexp_replace(
    regexp_replace(description, '\s*[—–\-]\s*pwofi\s+HatexCard', '', 'gi'),
    '\s+',
    ' ',
    'g'
  )
)
WHERE description ILIKE '%pwofi HatexCard%'
  AND type IN ('KYC_FEE', 'CARD_ACTIVATION', 'FEATURES_UNLOCK');

-- process_kyc_fee — menm lojik, deskripsyon san nòt pwofi
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
    RETURN json_build_object('success', true, 'already_paid', true, 'message', 'Frè KYC (soumèt) deja peye.');
  END IF;

  v_base := public.hatex_resolve_fee('kyc_fee', v_uid, 525);
  SELECT COALESCE(discount_amount, 0) INTO v_discount
  FROM public.user_discounts WHERE user_id = v_uid;
  v_discount := COALESCE(v_discount, 0);
  v_charge := GREATEST(0, v_base - v_discount);

  IF COALESCE(v_bal, 0) < v_charge THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Ou bezwen omwen ' || v_charge || ' HTG sou wallet pou pase KYC.',
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
      THEN 'Frè KYC soumèt dokiman (rediksyon -' || v_discount || ' HTG)'
      ELSE 'Frè KYC soumèt dokiman (525 HTG)'
    END
  );

  RETURN json_build_object(
    'success', true,
    'charged_htg', v_charge,
    'wallet_balance_htg', v_new,
    'phase', 'submit'
  );
END;
$$;

-- process_features_unlock_fee — deskripsyon san nòt pwofi
CREATE OR REPLACE FUNCTION public.process_features_unlock_fee(p_user_id UUID DEFAULT NULL)
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
  v_unlock BOOLEAN;
  v_base NUMERIC;
  v_charge NUMERIC;
  v_new NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_uid AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  SELECT wallet_balance, account_status, kyc_status,
         COALESCE(features_unlock_paid, false)
    INTO v_bal, v_status, v_kyc, v_unlock
  FROM public.profiles WHERE id = v_uid FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Pwofil pa jwenn.');
  END IF;
  IF v_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ou sispandi.');
  END IF;
  IF v_kyc IS DISTINCT FROM 'approved' THEN
    RETURN json_build_object('success', false, 'message', 'KYC dwe apwouve anvan ou debloke opsyon yo.');
  END IF;
  IF v_unlock THEN
    RETURN json_build_object(
      'success', true,
      'already_paid', true,
      'message', 'Opsyon yo deja debloke.'
    );
  END IF;

  v_base := public.hatex_resolve_fee('card_activation_fee', v_uid, 525);
  v_charge := GREATEST(0, v_base);

  IF COALESCE(v_bal, 0) < v_charge THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Ou bezwen ' || v_charge || ' HTG pou debloke kat, terminal ak fakti.',
      'amount_due_htg', v_charge,
      'wallet_balance_htg', v_bal,
      'needs_deposit', true
    );
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) - v_charge,
      features_unlock_paid = true,
      is_card_activated = true,
      is_activated = true
  WHERE id = v_uid
  RETURNING wallet_balance INTO v_new;

  INSERT INTO public.transactions (user_id, amount, type, status, description)
  VALUES (
    v_uid, -v_charge, 'CARD_ACTIVATION', 'success',
    'Frè debloke kat / terminal / fakti (525 HTG)'
  );

  RETURN json_build_object(
    'success', true,
    'charged_htg', v_charge,
    'wallet_balance_htg', v_new,
    'phase', 'unlock',
    'features_unlock_paid', true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_kyc_fee(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_kyc_fee(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_features_unlock_fee(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_features_unlock_fee(UUID) TO authenticated, service_role;
