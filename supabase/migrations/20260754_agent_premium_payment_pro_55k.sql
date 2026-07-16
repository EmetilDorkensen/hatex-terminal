-- ============================================================================
-- Ajan PRO = 55,000 HTG; PREMIUM = 110,000 HTG + frè aktivasyon dinamik.
-- Tout mouvman kòb fèt atomikman sou sèvè a.
-- ============================================================================

-- Aktivasyon premye fwa: montan plan an obligatwa, pa sèlman yon plafon.
CREATE OR REPLACE FUNCTION public.process_agent_activation(
  p_user_id UUID,
  p_amount NUMERIC,
  p_tier TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet NUMERIC;
  v_status TEXT;
  v_agent_status TEXT;
  v_fee NUMERIC;
  v_total NUMERIC;
  v_required NUMERIC;
  v_tier TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;

  v_tier := CASE
    WHEN lower(trim(p_tier)) IN ('pro', 'standard') THEN 'pro'
    WHEN lower(trim(p_tier)) = 'premium' THEN 'premium'
    ELSE NULL
  END;
  IF v_tier IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Plan pa valab. Chwazi PRO oswa PREMIUM.');
  END IF;

  v_required := CASE WHEN v_tier = 'premium' THEN 110000 ELSE 55000 END;
  IF p_amount IS NULL OR p_amount <> v_required THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Aktivasyon ' || upper(v_tier) || ' mande egzakteman ' ||
        to_char(v_required, 'FM999,999,990') || ' HTG.'
    );
  END IF;

  v_fee := public.hatex_agent_fee(v_required, p_user_id);
  v_total := v_required + v_fee;

  SELECT wallet_balance, account_status, agent_status
  INTO v_wallet, v_status, v_agent_status
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;
  IF v_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ou a sispandi.');
  END IF;
  IF COALESCE(v_agent_status, 'none') NOT IN ('none', 'rejected') THEN
    RETURN json_build_object('success', false, 'message', 'Gen yon kont oswa demann ajan ki deja aktif.');
  END IF;
  IF COALESCE(v_wallet, 0) < v_total THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Ou bezwen ' || to_char(v_required, 'FM999,999,990') ||
        ' HTG + ' || to_char(v_fee, 'FM999,999,990') ||
        ' HTG frè sou Wallet ou.'
    );
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_total,
      agent_balance = v_required,
      agent_capacity = v_required,
      agent_guarantee_paid = v_required,
      agent_status = 'pending',
      agent_tier = v_tier
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
  VALUES (
    p_user_id, 'AGENT_GUARANTEE', -v_required, 'success',
    'Aktivasyon Ajan ' || upper(v_tier),
    jsonb_build_object('tier', v_tier, 'guarantee', v_required)
  );
  INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
  VALUES (
    p_user_id, 'FEE', -v_fee, 'success',
    'Frè aktivasyon Ajan ' || upper(v_tier),
    jsonb_build_object('tier', v_tier, 'fee_paid', v_fee, 'category', 'agent_activation')
  );

  RETURN json_build_object(
    'success', true,
    'fee', v_fee,
    'tier', v_tier,
    'required_amount', v_required,
    'total_charged', v_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_agent_activation(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_agent_activation(UUID, NUMERIC, TEXT) TO authenticated, service_role;

-- Ogmantasyon kapasite: PRO ka rive 55,000; PREMIUM ka rive 110,000.
CREATE OR REPLACE FUNCTION public.process_agent_capacity_increase(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet NUMERIC;
  v_status TEXT;
  v_agent_status TEXT;
  v_fee NUMERIC;
  v_total NUMERIC;
  v_capacity NUMERIC;
  v_guarantee NUMERIC;
  v_tier TEXT;
  v_required NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  SELECT wallet_balance, account_status, agent_status, agent_capacity,
         agent_guarantee_paid, agent_tier
  INTO v_wallet, v_status, v_agent_status, v_capacity, v_guarantee, v_tier
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;
  IF v_status = 'suspended' OR v_agent_status IS DISTINCT FROM 'approved' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ajan an pa aktif.');
  END IF;

  v_required := CASE WHEN v_tier = 'premium' THEN 110000 ELSE 55000 END;
  IF (COALESCE(v_guarantee, 0) + p_amount) > v_required THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Ou ka ajoute sèlman ' ||
        to_char(GREATEST(0, v_required - COALESCE(v_guarantee, 0)), 'FM999,999,990') || ' HTG.'
    );
  END IF;

  v_fee := public.hatex_agent_fee(p_amount, p_user_id);
  v_total := p_amount + v_fee;
  IF COALESCE(v_wallet, 0) < v_total THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase kòb sou Wallet ou (montan + frè).');
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_total,
      agent_capacity = COALESCE(agent_capacity, 0) + p_amount,
      agent_balance = COALESCE(agent_balance, 0) + p_amount,
      agent_guarantee_paid = COALESCE(agent_guarantee_paid, 0) + p_amount
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
  VALUES (
    p_user_id, 'AGENT_CAPACITY', -p_amount, 'success',
    'Ogmantasyon kapasite ajan',
    jsonb_build_object('tier', v_tier, 'capacity_added', p_amount)
  );
  INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
  VALUES (
    p_user_id, 'FEE', -v_fee, 'success',
    'Frè ogmantasyon kapasite ajan',
    jsonb_build_object('tier', v_tier, 'fee_paid', v_fee, 'category', 'agent_capacity')
  );

  RETURN json_build_object('success', true, 'fee', v_fee, 'new_capacity', COALESCE(v_capacity, 0) + p_amount);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_agent_capacity_increase(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_agent_capacity_increase(UUID, NUMERIC) TO authenticated, service_role;

-- Upgrade PRO -> PREMIUM: kenbe diferans kapasite + frè pandan admin ap verifye.
CREATE OR REPLACE FUNCTION public.process_agent_premium_upgrade(
  p_user_id UUID,
  p_application_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prof RECORD;
  v_app RECORD;
  v_topup NUMERIC;
  v_fee NUMERIC;
  v_total NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;

  SELECT * INTO v_app
  FROM public.agent_applications
  WHERE id = p_application_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_app.status IS DISTINCT FROM 'pending'
     OR lower(COALESCE(v_app.tier, '')) <> 'premium'
     OR lower(COALESCE(v_app.application_type, '')) <> 'upgrade' THEN
    RETURN json_build_object('success', false, 'message', 'Demann Premium nan pa valab.');
  END IF;

  IF v_app.patente_url IS NULL OR v_app.cif_url IS NULL
     OR v_app.criminal_record_url IS NULL OR v_app.bank_statement_url IS NULL
     OR v_app.lease_doc_url IS NULL OR COALESCE(v_app.confidentiality_accepted, false) = false THEN
    RETURN json_build_object('success', false, 'message', 'Tout dokiman Premium yo obligatwa.');
  END IF;

  SELECT * INTO v_prof
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_prof.agent_status IS DISTINCT FROM 'approved'
     OR lower(COALESCE(v_prof.agent_tier, '')) = 'premium' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ajan sa a pa kalifye pou upgrade Premium.');
  END IF;
  IF COALESCE(v_prof.upgrade_status, 'none') = 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Gen yon upgrade Premium ki deja ankou.');
  END IF;

  v_topup := GREATEST(0, 110000 - COALESCE(v_prof.agent_guarantee_paid, 0));
  v_fee := public.hatex_agent_fee(v_topup, p_user_id);
  v_total := v_topup + v_fee;

  IF COALESCE(v_prof.wallet_balance, 0) < v_total THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Pou rive nan kapasite Premium 110,000 HTG, ou bezwen ' ||
        to_char(v_topup, 'FM999,999,990') || ' HTG + ' ||
        to_char(v_fee, 'FM999,999,990') || ' HTG frè sou Wallet ou.'
    );
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_total,
      upgrade_status = 'pending'
  WHERE id = p_user_id;

  UPDATE public.agent_applications
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'upgrade_deposit', v_topup,
        'fee_paid', v_fee,
        'target_capacity', 110000,
        'funds_held', true
      )
  WHERE id = p_application_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
  VALUES (
    p_user_id, 'AGENT_GUARANTEE', -v_topup, 'success',
    'Kòb an atant pou upgrade Ajan PREMIUM',
    jsonb_build_object('application_id', p_application_id, 'upgrade_deposit', v_topup, 'funds_held', true)
  );
  INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
  VALUES (
    p_user_id, 'FEE', -v_fee, 'success',
    'Frè aktivasyon upgrade Ajan PREMIUM',
    jsonb_build_object('application_id', p_application_id, 'fee_paid', v_fee, 'category', 'agent_activation')
  );

  RETURN json_build_object(
    'success', true,
    'upgrade_deposit', v_topup,
    'fee', v_fee,
    'total_charged', v_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_agent_premium_upgrade(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_agent_premium_upgrade(UUID, UUID) TO authenticated, service_role;

-- Kont PRO antrepriz gratis ak nouvo plafon an.
UPDATE public.profiles
SET agent_capacity = 55000
WHERE agent_tier = 'pro'
  AND agent_status = 'approved'
  AND account_type = 'business'
  AND COALESCE(agent_guarantee_paid, 0) = 0
  AND COALESCE(agent_capacity, 0) = 40000;

-- Kenbe nouvo kapasite a menm si yon ansyen RPC antrepriz ta toujou voye 40,000.
CREATE OR REPLACE FUNCTION public.hatex_enforce_pro_55k_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.agent_tier = 'pro'
     AND NEW.agent_status = 'approved'
     AND NEW.account_type = 'business'
     AND COALESCE(NEW.agent_guarantee_paid, 0) = 0
     AND COALESCE(NEW.agent_capacity, 0) = 40000 THEN
    NEW.agent_capacity := 55000;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hatex_enforce_pro_55k_capacity ON public.profiles;
CREATE TRIGGER trg_hatex_enforce_pro_55k_capacity
BEFORE INSERT OR UPDATE OF agent_tier, agent_status, account_type, agent_guarantee_paid, agent_capacity
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.hatex_enforce_pro_55k_capacity();

-- Review admin: upgrade Premium pa dwe efase ansyen kont PRO si yo rejte li.
CREATE OR REPLACE FUNCTION public.admin_review_agent_application(
  p_application_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_is_admin BOOLEAN;
  v_is_staff BOOLEAN;
  v_app RECORD;
  v_prof RECORD;
  v_is_upgrade BOOLEAN;
  v_paid NUMERIC := 0;
  v_fee NUMERIC := 0;
  v_held_paid NUMERIC := 0;
  v_held_fee NUMERIC := 0;
  v_refund NUMERIC := 0;
  v_max NUMERIC;
  v_new_bal NUMERIC;
BEGIN
  IF p_action NOT IN ('approved', 'rejected') THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa valab.');
  END IF;

  v_is_admin := v_email = 'adminhatexcard@gmail.com';
  v_is_staff := EXISTS (
    SELECT 1 FROM public.staff_users WHERE email = v_email AND status = 'active'
  );
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT (v_is_admin OR v_is_staff) THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  SELECT * INTO v_app
  FROM public.agent_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND OR v_app.user_id IS DISTINCT FROM p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Aplikasyon ajan pa jwenn.');
  END IF;
  IF v_app.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Aplikasyon sa a deja trete.', 'status', v_app.status);
  END IF;
  IF p_action = 'rejected' AND length(trim(COALESCE(p_reason, ''))) = 0 THEN
    RETURN json_build_object('success', false, 'message', 'Rezon rejè obligatwa.');
  END IF;

  SELECT * INTO v_prof
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Pwofil pa jwenn.');
  END IF;

  v_is_upgrade := lower(COALESCE(v_app.application_type, 'new')) = 'upgrade';

  BEGIN
    IF v_is_upgrade THEN
      v_paid := COALESCE((v_app.metadata->>'upgrade_deposit')::numeric, 0);
    ELSE
      v_paid := COALESCE(v_prof.agent_guarantee_paid, 0);
    END IF;
    v_fee := COALESCE((v_app.metadata->>'fee_paid')::numeric, 0);
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', 'Done peman aplikasyon an pa valab.');
  END;

  -- Upgrade PRO -> PREMIUM
  IF v_is_upgrade THEN
    IF COALESCE(v_app.metadata->>'funds_held', 'false') <> 'true' THEN
      RETURN json_build_object('success', false, 'message', 'Peman upgrade Premium nan pa konfime.');
    END IF;

    -- Pa fè konfyans metadata navigatè a: tranzaksyon SECURITY DEFINER yo
    -- dwe pwouve egzakteman konbyen garanti ak frè sistèm nan te pran.
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_held_paid
    FROM public.transactions
    WHERE user_id = p_user_id
      AND type = 'AGENT_GUARANTEE'
      AND status = 'success'
      AND metadata->>'application_id' = p_application_id::text;

    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_held_fee
    FROM public.transactions
    WHERE user_id = p_user_id
      AND type = 'FEE'
      AND status = 'success'
      AND metadata->>'application_id' = p_application_id::text;

    IF v_held_paid <> v_paid OR v_held_fee <> v_fee OR v_held_paid <= 0 THEN
      RETURN json_build_object('success', false, 'message', 'Prèv peman upgrade Premium nan pa matche.');
    END IF;

    IF p_action = 'approved' THEN
      UPDATE public.profiles
      SET agent_tier = 'premium',
          agent_capacity = 110000,
          agent_guarantee_paid = COALESCE(agent_guarantee_paid, 0) + v_paid,
          agent_balance = COALESCE(agent_balance, 0) + v_paid,
          upgrade_status = 'approved'
      WHERE id = p_user_id;

      UPDATE public.agent_applications
      SET status = 'approved',
          rejection_reason = NULL,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('funds_held', false)
      WHERE id = p_application_id;

      RETURN json_build_object(
        'success', true,
        'action', 'approved',
        'upgrade', true,
        'capacity_added', v_paid,
        'refund', 0,
        'fee_refunded', 0
      );
    END IF;

    v_refund := v_paid + v_fee;
    v_max := CASE WHEN v_prof.account_type = 'business' THEN 2000000 ELSE 105000 END;
    IF COALESCE(v_prof.wallet_balance, 0) + v_refund > v_max THEN
      RETURN json_build_object('success', false, 'message', 'Ranbousman ta depase limit balans maksimòm.');
    END IF;

    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_refund,
        upgrade_status = 'rejected'
    WHERE id = p_user_id
    RETURNING wallet_balance INTO v_new_bal;

    INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
    VALUES (
      p_user_id, v_refund, 'REFUND',
      'Ranbousman upgrade Ajan PREMIUM rejte', 'success',
      jsonb_build_object(
        'application_id', p_application_id,
        'guarantee_refunded', v_paid,
        'fee_refunded', v_fee,
        'category', 'agent_premium_upgrade'
      )
    );

    IF v_fee > 0 THEN
      INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
      VALUES (
        p_user_id, v_fee, 'FEE_REFUND',
        'Ranbousman frè upgrade Ajan PREMIUM', 'success',
        jsonb_build_object(
          'application_id', p_application_id,
          'category', 'agent_activation',
          'reviewed_by', NULLIF(v_email, '')
        )
      );
    END IF;

    UPDATE public.agent_applications
    SET status = 'rejected',
        rejection_reason = trim(p_reason),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('funds_held', false)
    WHERE id = p_application_id;

    RETURN json_build_object(
      'success', true,
      'action', 'rejected',
      'upgrade', true,
      'refund', v_refund,
      'fee_refunded', v_fee,
      'guarantee_refunded', v_paid,
      'wallet_balance', v_new_bal
    );
  END IF;

  -- Premye aktivasyon PRO/PREMIUM
  IF p_action = 'approved' THEN
    UPDATE public.profiles SET agent_status = 'approved' WHERE id = p_user_id;
    UPDATE public.agent_applications
    SET status = 'approved', rejection_reason = NULL
    WHERE id = p_application_id;
    RETURN json_build_object('success', true, 'action', 'approved', 'refund', 0, 'fee_refunded', 0);
  END IF;

  -- Fallback pou ansyen aplikasyon ki pa t gen fee_paid nan metadata.
  -- Toujou sèvi ak ledger sèvè a kòm sous verite; metadata kliyan an pa sifi.
  SELECT ABS(amount) INTO v_held_fee
  FROM public.transactions
  WHERE user_id = p_user_id
    AND type = 'FEE'
    AND status = 'success'
    AND description ILIKE '%aktivasyon%Ajan%'
  ORDER BY created_at DESC
  LIMIT 1;
  IF COALESCE(v_held_fee, 0) > 0 THEN
    v_fee := v_held_fee;
  ELSE
    v_fee := GREATEST(0, v_fee);
  END IF;

  v_refund := v_paid + v_fee;
  v_max := CASE WHEN v_prof.account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF COALESCE(v_prof.wallet_balance, 0) + v_refund > v_max THEN
    RETURN json_build_object('success', false, 'message', 'Ranbousman ta depase limit balans maksimòm.');
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_refund,
      agent_balance = 0,
      agent_capacity = 0,
      agent_guarantee_paid = 0,
      agent_status = 'rejected',
      agent_tier = NULL,
      agent_code = NULL
  WHERE id = p_user_id
  RETURNING wallet_balance INTO v_new_bal;

  INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
  VALUES (
    p_user_id, v_refund, 'REFUND',
    'Ranbousman Aplikasyon Ajan ki Rejte (garanti + frè)', 'success',
    jsonb_build_object(
      'application_id', p_application_id,
      'guarantee_refunded', v_paid,
      'fee_refunded', v_fee,
      'category', 'agent_rejection'
    )
  );

  IF v_fee > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
    VALUES (
      p_user_id, v_fee, 'FEE_REFUND',
      'Ranbousman frè ajan (soti nan pwofi HatexCard)', 'success',
      jsonb_build_object(
        'application_id', p_application_id,
        'category', 'agent_activation',
        'reviewed_by', NULLIF(v_email, '')
      )
    );
  END IF;

  UPDATE public.agent_applications
  SET status = 'rejected', rejection_reason = trim(p_reason)
  WHERE id = p_application_id;

  RETURN json_build_object(
    'success', true,
    'action', 'rejected',
    'refund', v_refund,
    'fee_refunded', v_fee,
    'guarantee_refunded', v_paid,
    'wallet_balance', v_new_bal
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
