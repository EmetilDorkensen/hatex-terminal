-- ============================================================================
-- Fix: rejte/apwouve upgrade Premium san funds_held (ansyen demann dokiman sèlman)
-- ============================================================================

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
  v_funds_held BOOLEAN;
  v_paid NUMERIC := 0;
  v_fee NUMERIC := 0;
  v_held_paid NUMERIC := 0;
  v_held_fee NUMERIC := 0;
  v_refund NUMERIC := 0;
  v_topup NUMERIC := 0;
  v_total NUMERIC := 0;
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
  v_funds_held := COALESCE(v_app.metadata->>'funds_held', 'false') = 'true';

  BEGIN
    IF v_is_upgrade THEN
      v_paid := COALESCE((v_app.metadata->>'upgrade_deposit')::numeric, 0);
    ELSE
      v_paid := COALESCE(v_prof.agent_guarantee_paid, 0);
    END IF;
    v_fee := COALESCE((v_app.metadata->>'fee_paid')::numeric, 0);
  EXCEPTION WHEN OTHERS THEN
    v_paid := CASE WHEN v_is_upgrade THEN 0 ELSE COALESCE(v_prof.agent_guarantee_paid, 0) END;
    v_fee := 0;
  END;

  -- =========================================================================
  -- Upgrade PRO -> PREMIUM
  -- =========================================================================
  IF v_is_upgrade THEN
    -- Ledger sèvè (si gen peman an atant)
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

    -- Si metadata di funds_held men ledger pa matche, itilize ledger la
    IF v_funds_held THEN
      IF v_held_paid > 0 THEN
        v_paid := v_held_paid;
        v_fee := v_held_fee;
      ELSIF v_paid <= 0 AND v_held_paid <= 0 THEN
        -- Metadata fo / ansyen: trete kòm san peman
        v_funds_held := false;
      ELSIF v_held_paid > 0 AND (v_held_paid <> COALESCE((v_app.metadata->>'upgrade_deposit')::numeric, -1)
            OR v_held_fee <> COALESCE((v_app.metadata->>'fee_paid')::numeric, -1)) THEN
        -- Ledger genyen; sèvi ak ledger
        v_paid := v_held_paid;
        v_fee := v_held_fee;
      ELSIF v_held_paid <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'Prèv peman upgrade Premium nan pa matche.');
      END IF;
    ELSIF v_held_paid > 0 THEN
      -- Pa gen flag men gen kòb an atant sou ledger
      v_funds_held := true;
      v_paid := v_held_paid;
      v_fee := v_held_fee;
    END IF;

    -- ----- Ansyen demann (dokiman sèlman, san kòb an atant) -----
    IF NOT v_funds_held THEN
      IF p_action = 'rejected' THEN
        UPDATE public.profiles
        SET upgrade_status = 'rejected'
        WHERE id = p_user_id;

        UPDATE public.agent_applications
        SET status = 'rejected', rejection_reason = trim(p_reason)
        WHERE id = p_application_id;

        RETURN json_build_object(
          'success', true,
          'action', 'rejected',
          'upgrade', true,
          'legacy', true,
          'refund', 0,
          'fee_refunded', 0,
          'message', 'Upgrade Premium rejte (pa te gen kòb an atant).'
        );
      END IF;

      -- Apwouve ansyen demann: chaje diferans + frè kounye a (egzakteman)
      v_topup := GREATEST(0, 110000 - COALESCE(v_prof.agent_guarantee_paid, 0));
      v_fee := public.hatex_agent_fee(v_topup, p_user_id);
      v_total := v_topup + v_fee;

      IF COALESCE(v_prof.wallet_balance, 0) < v_total THEN
        RETURN json_build_object(
          'success', false,
          'message', 'Ajan an bezwen ' || to_char(v_topup, 'FM999,999,990') ||
            ' HTG + ' || to_char(v_fee, 'FM999,999,990') ||
            ' HTG frè sou Wallet pou finalize Premium. Rejte epi mande l re-soumèt, oswa tann li gen kòb la.'
        );
      END IF;

      UPDATE public.profiles
      SET wallet_balance = wallet_balance - v_total,
          agent_tier = 'premium',
          agent_capacity = 110000,
          agent_guarantee_paid = COALESCE(agent_guarantee_paid, 0) + v_topup,
          agent_balance = COALESCE(agent_balance, 0) + v_topup,
          upgrade_status = 'approved'
      WHERE id = p_user_id;

      IF v_topup > 0 THEN
        INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
        VALUES (
          p_user_id, 'AGENT_GUARANTEE', -v_topup, 'success',
          'Finalize upgrade Ajan PREMIUM (admin apwouve)',
          jsonb_build_object('application_id', p_application_id, 'upgrade_deposit', v_topup)
        );
      END IF;
      IF v_fee > 0 THEN
        INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
        VALUES (
          p_user_id, 'FEE', -v_fee, 'success',
          'Frè aktivasyon upgrade Ajan PREMIUM (admin apwouve)',
          jsonb_build_object(
            'application_id', p_application_id,
            'fee_paid', v_fee,
            'category', 'agent_activation'
          )
        );
      END IF;

      UPDATE public.agent_applications
      SET status = 'approved',
          rejection_reason = NULL,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'upgrade_deposit', v_topup,
            'fee_paid', v_fee,
            'funds_held', false,
            'charged_on_approve', true
          )
      WHERE id = p_application_id;

      RETURN json_build_object(
        'success', true,
        'action', 'approved',
        'upgrade', true,
        'legacy', true,
        'capacity_added', v_topup,
        'fee', v_fee,
        'refund', 0,
        'fee_refunded', 0
      );
    END IF;

    -- ----- Demann ak kòb an atant (nouvo sistèm) -----
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

    -- Rejte + ranbouse kòb an atant
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

  -- =========================================================================
  -- Premye aktivasyon PRO/PREMIUM (pa upgrade)
  -- =========================================================================
  IF p_action = 'approved' THEN
    UPDATE public.profiles SET agent_status = 'approved' WHERE id = p_user_id;
    UPDATE public.agent_applications
    SET status = 'approved', rejection_reason = NULL
    WHERE id = p_application_id;
    RETURN json_build_object('success', true, 'action', 'approved', 'refund', 0, 'fee_refunded', 0);
  END IF;

  -- Frè egzak: ledger sèvè anvan metadata
  SELECT ABS(amount) INTO v_held_fee
  FROM public.transactions
  WHERE user_id = p_user_id
    AND type = 'FEE'
    AND status = 'success'
    AND (
      description ILIKE '%aktivasyon%Ajan%'
      OR description ILIKE '%aktivasyon Ajan%'
      OR COALESCE(metadata->>'category', '') = 'agent_activation'
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF COALESCE(v_held_fee, 0) > 0 THEN
    v_fee := v_held_fee;
  ELSE
    v_fee := GREATEST(0, v_fee);
  END IF;

  v_refund := COALESCE(v_paid, 0) + COALESCE(v_fee, 0);
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
      agent_code = NULL,
      upgrade_status = COALESCE(upgrade_status, 'none')
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
    'guarantee_refunded', COALESCE(v_paid, 0),
    'wallet_balance', v_new_bal
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
