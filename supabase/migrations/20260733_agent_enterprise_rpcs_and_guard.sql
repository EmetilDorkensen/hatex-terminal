-- ============================================================================
-- FAZ 2 SEKIRITE — RPC ATOMIK AJAN/ANTREPRIZ + TRIGER PWOTEKSYON BALANS
-- ============================================================================
-- Objektif: fè li ENPOSIB pou yon itilizatè nòmal modifye balans (wallet/kat/
-- ajan) oswa estati privilèj (kyc/account/agent/enterprise) dirèkteman depi
-- navigatè a (anon key). Tout mouvman kòb pase pa fonksyon SECURITY DEFINER
-- sa yo, epi yon triger bloke nenpòt lòt chanjman ki soti dirèkteman nan yon
-- sesyon itilizatè nòmal.
--
-- Admin (adminhatexcard@gmail.com) ak staff aktif TOUJOU gen dwa (dashboard
-- admin/workspace kontinye mache). Apèl service_role ak RPC yo pase san pwoblèm.
-- ============================================================================

-- ============================================================
-- HELPER: frè ajan = 7 HTG pou chak 1000 HTG (menm ak app la)
-- ============================================================
CREATE OR REPLACE FUNCTION public.hatex_agent_fee(p_amount NUMERIC)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT floor((p_amount / 1000.0) * 7);
$$;

-- ============================================================
-- 1. AKTIVASYON AJAN
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_agent_activation(
  p_user_id UUID,
  p_amount NUMERIC,
  p_tier TEXT
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wallet NUMERIC;
  v_status TEXT;
  v_fee NUMERIC;
  v_total NUMERIC;
  v_max NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;
  IF p_tier NOT IN ('standard', 'premium') THEN
    RETURN json_build_object('success', false, 'message', 'Plan pa valab.');
  END IF;

  v_max := CASE WHEN p_tier = 'premium' THEN 110000 ELSE 40000 END;
  IF p_amount > v_max THEN
    RETURN json_build_object('success', false, 'message', 'Montan an depase kapasite maksimòm plan an.');
  END IF;

  v_fee := public.hatex_agent_fee(p_amount);
  v_total := p_amount + v_fee;

  SELECT wallet_balance, account_status INTO v_wallet, v_status
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;
  IF v_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ou a sispandi.');
  END IF;
  IF COALESCE(v_wallet, 0) < v_total THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase kòb sou Wallet ou.');
  END IF;

  UPDATE public.profiles SET
    wallet_balance = wallet_balance - v_total,
    agent_balance = p_amount,
    agent_capacity = p_amount,
    agent_guarantee_paid = p_amount,
    agent_status = 'pending',
    agent_tier = p_tier
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (p_user_id, 'AGENT_GUARANTEE', -p_amount, 'success', 'Aktivasyon Ajan ' || upper(p_tier));
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (p_user_id, 'FEE', -v_fee, 'success', 'Frè aktivasyon Ajan (7 HTG / 1000 HTG)');

  RETURN json_build_object('success', true, 'fee', v_fee);
END;
$$;

-- ============================================================
-- 2. RECHAJ BALANS AJAN (san frè)
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_agent_recharge(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wallet NUMERIC; v_agent_bal NUMERIC; v_capacity NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  SELECT wallet_balance, agent_balance, agent_capacity INTO v_wallet, v_agent_bal, v_capacity
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;
  IF p_amount > (COALESCE(v_capacity, 0) - COALESCE(v_agent_bal, 0)) THEN
    RETURN json_build_object('success', false, 'message', 'Montan an depase kapasite ki rete a.');
  END IF;
  IF COALESCE(v_wallet, 0) < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase kòb sou Wallet ou.');
  END IF;

  UPDATE public.profiles SET
    wallet_balance = wallet_balance - p_amount,
    agent_balance = COALESCE(agent_balance, 0) + p_amount
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (p_user_id, 'AGENT_RECHARGE', p_amount, 'success', 'Rechaj balans ajan san frè');
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (p_user_id, 'WITHDRAWAL', -p_amount, 'success', 'Retrè pou rechaje kont ajan');

  RETURN json_build_object('success', true);
END;
$$;

-- ============================================================
-- 3. OGMANTE KAPASITE AJAN (ak frè)
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_agent_capacity_increase(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wallet NUMERIC; v_tier TEXT; v_guarantee NUMERIC; v_fee NUMERIC; v_total NUMERIC; v_required NUMERIC; v_remaining NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  v_fee := public.hatex_agent_fee(p_amount);
  v_total := p_amount + v_fee;

  SELECT wallet_balance, agent_tier, agent_guarantee_paid INTO v_wallet, v_tier, v_guarantee
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;

  v_required := CASE WHEN v_tier = 'premium' THEN 110000 ELSE 40000 END;
  v_remaining := v_required - COALESCE(v_guarantee, 0);

  IF p_amount > v_remaining THEN
    RETURN json_build_object('success', false, 'message', 'Montan an depase kapasite ki rete pou ogmante a.');
  END IF;
  IF COALESCE(v_wallet, 0) < v_total THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase kòb (kòb + frè).');
  END IF;

  UPDATE public.profiles SET
    wallet_balance = wallet_balance - v_total,
    agent_guarantee_paid = COALESCE(agent_guarantee_paid, 0) + p_amount,
    agent_capacity = COALESCE(agent_capacity, 0) + p_amount,
    agent_balance = COALESCE(agent_balance, 0) + p_amount
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (p_user_id, 'AGENT_GUARANTEE', -p_amount, 'success', 'Ogmante kapasite ajan');
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (p_user_id, 'FEE', -v_fee, 'success', 'Frè ogmantasyon kapasite ajan (7/1000 HTG)');

  RETURN json_build_object('success', true, 'fee', v_fee);
END;
$$;

-- ============================================================
-- 4. DEPO AJAN POU KLIYAN
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_agent_client_deposit(
  p_agent_id UUID,
  p_client_email TEXT,
  p_amount NUMERIC
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agent_status TEXT; v_agent_bal NUMERIC; v_agent_code TEXT; v_agent_name TEXT;
  v_client_id UUID; v_client_wallet NUMERIC; v_client_status TEXT; v_client_type TEXT; v_client_name TEXT;
  v_max NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_agent_id THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  SELECT account_status, agent_balance, agent_code, full_name
    INTO v_agent_status, v_agent_bal, v_agent_code, v_agent_name
  FROM public.profiles WHERE id = p_agent_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Ajan pa jwenn.');
  END IF;
  IF v_agent_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ou a sispandi.');
  END IF;
  IF COALESCE(v_agent_bal, 0) < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase kòb sou balans Ajan w lan.');
  END IF;

  SELECT id, wallet_balance, account_status, account_type, full_name
    INTO v_client_id, v_client_wallet, v_client_status, v_client_type, v_client_name
  FROM public.profiles WHERE email = lower(trim(p_client_email)) FOR UPDATE;

  IF v_client_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Pa jwenn okenn kliyan ak imèl sa a.');
  END IF;
  IF v_client_id = p_agent_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa ka fè depo pou pwòp tèt ou.');
  END IF;
  IF v_client_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan an sispandi.');
  END IF;

  v_max := CASE WHEN v_client_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_client_wallet, 0) + p_amount) > v_max THEN
    RETURN json_build_object('success', false, 'message', 'Balans kliyan an ta depase limit maksimòm otorize a.');
  END IF;

  UPDATE public.profiles SET agent_balance = agent_balance - p_amount WHERE id = p_agent_id;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount WHERE id = v_client_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
  VALUES (p_agent_id, 'AGENT_DEPOSIT', -p_amount, 'success', 'Depo pou ' || COALESCE(v_client_name, ''), jsonb_build_object('client_email', p_client_email));
  INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
  VALUES (v_client_id, 'DEPOSIT', p_amount, 'success', 'Depo nan men Ajan: ' || COALESCE(v_agent_code, ''), jsonb_build_object('agent_code', v_agent_code));

  RETURN json_build_object('success', true, 'client_name', v_client_name);
END;
$$;

-- ============================================================
-- 5. RESTART APLIKASYON AJAN (reset estati) — pa pou kont ki deja apwouve
-- ============================================================
CREATE OR REPLACE FUNCTION public.agent_restart_application(p_user_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;

  SELECT agent_status INTO v_status FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_status = 'approved' THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa ka rekòmanse yon aplikasyon ki deja apwouve.');
  END IF;

  UPDATE public.profiles SET agent_status = 'none', upgrade_status = 'none' WHERE id = p_user_id;
  RETURN json_build_object('success', true);
END;
$$;

-- ============================================================
-- 6. FRÈ PASAJ ANTREPRIZ (49,000 HTG — fiks sou sèvè)
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_enterprise_fee(p_user_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wallet NUMERIC; v_status TEXT; v_ent_status TEXT;
  c_fee CONSTANT NUMERIC := 49000;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;

  SELECT wallet_balance, account_status, enterprise_status INTO v_wallet, v_status, v_ent_status
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;
  IF v_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ou a sispandi.');
  END IF;
  IF v_ent_status = 'pending' OR v_ent_status = 'approved' THEN
    RETURN json_build_object('success', false, 'message', 'Ou gen yon aplikasyon antrepriz deja.');
  END IF;
  IF COALESCE(v_wallet, 0) < c_fee THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase kòb pou peye frè pasaj la.');
  END IF;

  UPDATE public.profiles SET
    wallet_balance = wallet_balance - c_fee,
    enterprise_status = 'pending',
    enterprise_fee_paid = c_fee
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (p_user_id, 'ENTERPRISE_FEE', -c_fee, 'success', 'Frè Pasaj Kont Antrepriz');

  RETURN json_build_object('success', true, 'fee', c_fee);
END;
$$;

-- ============================================================
-- 7. TRIGER PWOTEKSYON: bloke chanjman balans/privilèj depi itilizatè nòmal
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT := auth.jwt() ->> 'email';
BEGIN
  -- Apèl ki soti nan RPC SECURITY DEFINER (current_user = pwopriyetè, pa
  -- 'authenticated'/'anon') oswa service_role pase san restriksyon.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- Admin + staff aktif gen dwa (dashboard admin/workspace).
  IF v_email = 'adminhatexcard@gmail.com' THEN
    RETURN NEW;
  END IF;
  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.staff_users WHERE email = lower(v_email) AND status = 'active'
  ) THEN
    RETURN NEW;
  END IF;

  -- Itilizatè nòmal: okenn chanjman sou kolòn sansib sa yo pa otorize dirèkteman.
  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance
     OR NEW.card_balance IS DISTINCT FROM OLD.card_balance
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
     OR COALESCE(NEW.card_number, '') IS DISTINCT FROM COALESCE(OLD.card_number, '')
     OR COALESCE(NEW.card_number_hash, '') IS DISTINCT FROM COALESCE(OLD.card_number_hash, '')
     OR COALESCE(NEW.cvv, '') IS DISTINCT FROM COALESCE(OLD.cvv, '')
     OR COALESCE(NEW.cvv_hash, '') IS DISTINCT FROM COALESCE(OLD.cvv_hash, '')
     OR COALESCE(NEW.pin_code_hash, '') IS DISTINCT FROM COALESCE(OLD.pin_code_hash, '')
     OR COALESCE(NEW.api_key, '') IS DISTINCT FROM COALESCE(OLD.api_key, '')
     OR COALESCE(NEW.api_key_hash, '') IS DISTINCT FROM COALESCE(OLD.api_key_hash, '')
     OR COALESCE(NEW.webhook_secret, '') IS DISTINCT FROM COALESCE(OLD.webhook_secret, '')
     OR COALESCE(NEW.agent_code, '') IS DISTINCT FROM COALESCE(OLD.agent_code, '')
  THEN
    RAISE EXCEPTION 'Chanjman sa a pa otorize dirèkteman. Sèvi ak operasyon ofisyèl sistèm nan.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_sensitive_columns();

-- ============================================================
-- DWA EGZEKISYON
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.process_agent_activation(UUID, NUMERIC, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_agent_recharge(UUID, NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_agent_capacity_increase(UUID, NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_agent_client_deposit(UUID, TEXT, NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION public.agent_restart_application(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_enterprise_fee(UUID) FROM anon;

GRANT EXECUTE ON FUNCTION public.process_agent_activation(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_agent_recharge(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_agent_capacity_increase(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_agent_client_deposit(UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_restart_application(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_enterprise_fee(UUID) TO authenticated;

-- ============================================================================
-- APRE MIGRASYON — kouri nan Supabase > SQL Editor.
-- Apre sa, paj agent/enterprise ap rele RPC sa yo (pa .update() balans ankò).
-- Admin/workspace kontinye mache paske triger a kite admin/staff pase.
-- ============================================================================
