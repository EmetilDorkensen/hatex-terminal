-- ============================================================================
-- KYC frè divize: 525 HTG soumèt + 525 HTG debloke (kat / terminal / invoice)
-- Tout kalkil nan baz — pa fè konfyans navigatè.
-- ============================================================================

-- 1) Kolòn debloke
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS features_unlock_paid BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.features_unlock_paid IS
  'Dezyèm frè 525 HTG peye — debloke kat, terminal, invoice apre KYC apwouve.';

-- Itilizatè ki deja apwouve + kat aktif: yo deja "debloke"
UPDATE public.profiles
SET features_unlock_paid = true
WHERE kyc_status = 'approved'
  AND COALESCE(is_card_activated, false) = true
  AND COALESCE(features_unlock_paid, false) = false;

-- 2) Frè global: 525 + 525
UPDATE public.platform_fee_settings
SET value = 525,
    label = 'Frè KYC (soumèt dokiman)',
    description = 'Premye 525 HTG — obligatwa pou soumèt KYC; ale nan pwofi biznis',
    updated_at = now()
WHERE fee_key = 'kyc_fee';

UPDATE public.platform_fee_settings
SET value = 525,
    label = 'Frè debloke kat / terminal / fakti',
    description = 'Dezyèm 525 HTG — apre KYC apwouve pou aktive kat, terminal, invoice',
    updated_at = now()
WHERE fee_key = 'card_activation_fee';

INSERT INTO public.platform_fee_settings (fee_key, label, value, unit, description)
VALUES (
  'card_activation_fee',
  'Frè debloke kat / terminal / fakti',
  525,
  'flat',
  'Dezyèm 525 HTG — apre KYC apwouve'
)
ON CONFLICT (fee_key) DO UPDATE
SET value = 525,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    updated_at = now();

-- 3) process_kyc_fee — 525 default, deskripsyon soumèt
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
      THEN 'Frè KYC soumèt dokiman (rediksyon -' || v_discount || ' HTG) — pwofi HatexCard'
      ELSE 'Frè KYC soumèt dokiman (525 HTG) — pwofi HatexCard'
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

-- 4) process_features_unlock_fee — dezyèm 525, debloke kat/terminal/invoice
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
    'Frè debloke kat / terminal / fakti (525 HTG) — pwofi HatexCard'
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

REVOKE EXECUTE ON FUNCTION public.process_features_unlock_fee(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_features_unlock_fee(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_kyc_fee(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_kyc_fee(UUID) TO authenticated, service_role;
