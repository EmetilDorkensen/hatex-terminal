-- ============================================================================
-- Retrè kay ajan: frè 50 HTG / 1,000 HTG
--   20% → wallet ajan (komisyon)
--   80% → pwofi HatexCard (AGENT_WITHDRAW_FEE)
-- Kliyan debitiye: montan kach + frè (frè anplis)
-- Ajan: agent_balance += montan kach (pou remèt kach)
-- Kouri nan Supabase > SQL Editor apre deploy.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_wallet_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_phone TEXT DEFAULT NULL,
  p_agent_code TEXT DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_kyc TEXT;
  v_account_type TEXT;
  v_balance NUMERIC;
  v_agent RECORD;
  v_fee NUMERIC;
  v_net NUMERIC;
  v_agent_share NUMERIC;
  v_hatex_share NUMERIC;
  v_total_debit NUMERIC;
  v_is_large BOOLEAN;
  v_withdrawal_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen otorizasyon pou operasyon sa a.');
  END IF;

  IF p_amount IS NULL OR p_amount < 500 THEN
    RETURN json_build_object('success', false, 'message', 'Minimòm retrè se 500 HTG.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  SELECT account_status, kyc_status, account_type, wallet_balance
    INTO v_status, v_kyc, v_account_type, v_balance
  FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Sistèm nan pa jwenn kont ou pou verifye l.');
  END IF;

  IF v_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ou a sispandi. Ou pa gen otorizasyon pou w fè retrè.');
  END IF;

  IF v_kyc IS DISTINCT FROM 'approved' THEN
    RETURN json_build_object('success', false, 'message', 'Ou dwe pase KYC anvan ou ka fè retrè.');
  END IF;

  -- ============================================================
  -- RETRÈ KAY AJAN: 50 HTG / 1,000 · 20% ajan · 80% HatexCard
  -- ============================================================
  IF p_method = 'Ajan' THEN
    IF p_agent_code IS NULL OR length(trim(p_agent_code)) <> 8 THEN
      RETURN json_build_object('success', false, 'message', 'Tanpri mete Kòd 8-Chif Ajan an kòrèkteman.');
    END IF;

    -- Frè: 50 HTG pou chak 1,000 HTG (5%). Kliyan peye frè a ANPLIS montan kach la.
    v_fee := ROUND((p_amount / 1000.0) * 50, 2);
    IF v_fee < 0 THEN
      RETURN json_build_object('success', false, 'message', 'Frè pa valab.');
    END IF;
    v_agent_share := ROUND(v_fee * 0.20, 2);
    v_hatex_share := ROUND(v_fee - v_agent_share, 2);
    v_total_debit := p_amount + v_fee;
    v_net := p_amount; -- kach ajan ap bay kliyan an

    BEGIN
      PERFORM public.hatex_assert_individual_spending_limit(p_user_id, v_account_type, v_total_debit, 'withdraw');
    EXCEPTION WHEN OTHERS THEN
      RETURN json_build_object('success', false, 'message', SQLERRM);
    END;

    IF COALESCE(v_balance, 0) < v_total_debit THEN
      RETURN json_build_object(
        'success', false,
        'message',
        'Ou pa gen ase kòb. Ou bezwen ' || v_total_debit || ' HTG (montan + frè ' || v_fee || ' HTG).'
      );
    END IF;

    SELECT id, agent_balance, agent_capacity, agent_status, full_name, wallet_balance
    INTO v_agent
    FROM public.profiles
    WHERE agent_code = trim(p_agent_code)
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'message', 'Sistèm nan pa jwenn okenn ajan ak kòd sa a.');
    END IF;

    IF v_agent.agent_status IS DISTINCT FROM 'approved' THEN
      RETURN json_build_object('success', false, 'message', 'Ajan sa a pa aktif kounye a.');
    END IF;

    IF v_agent.id = p_user_id THEN
      RETURN json_build_object('success', false, 'message', 'Ou pa ka fè retrè sou pwòp kòd ajan pa w la.');
    END IF;

    IF COALESCE(v_agent.agent_capacity, 0) > 0
       AND (COALESCE(v_agent.agent_balance, 0) + p_amount) > v_agent.agent_capacity THEN
      RETURN json_build_object(
        'success', false,
        'message',
        'Ajan sa a pa gen ase kapasite pou trete retrè sa a. Eseye yon lòt ajan oswa yon lòt metòd.'
      );
    END IF;

    -- Debite kliyan (kach + frè)
    UPDATE public.profiles
    SET wallet_balance = wallet_balance - v_total_debit
    WHERE id = p_user_id;

    -- Kredite float ajan (pou remèt kach)
    UPDATE public.profiles
    SET agent_balance = COALESCE(agent_balance, 0) + p_amount,
        wallet_balance = COALESCE(wallet_balance, 0) + v_agent_share
    WHERE id = v_agent.id;

    -- Tranzaksyon kliyan: montan kach
    INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
    VALUES (
      p_user_id,
      'AGENT_WITHDRAWAL_CLIENT',
      -p_amount,
      'success',
      'Retrè kach kay ajan: ' || trim(p_agent_code),
      jsonb_build_object(
        'agent_code', trim(p_agent_code),
        'agent_id', v_agent.id,
        'cash_amount', p_amount,
        'fee', v_fee,
        'agent_share', v_agent_share,
        'hatex_share', v_hatex_share
      )
    );

    -- Tranzaksyon kliyan: frè total (pou istwa)
    IF v_fee > 0 THEN
      INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
      VALUES (
        p_user_id,
        'AGENT_WITHDRAW_CLIENT_FEE',
        -v_fee,
        'success',
        'Frè retrè ajan (50 HTG / 1,000)',
        jsonb_build_object('agent_id', v_agent.id, 'cash_amount', p_amount)
      );
    END IF;

    -- Tranzaksyon ajan: float + komisyon
    INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
    VALUES (
      v_agent.id,
      'AGENT_WITHDRAWAL',
      p_amount,
      'success',
      'Retrè Kliyan: ' || COALESCE(p_user_email, ''),
      jsonb_build_object(
        'client_email', p_user_email,
        'client_id', p_user_id,
        'fee', v_fee,
        'agent_share', v_agent_share,
        'hatex_share', v_hatex_share
      )
    );

    IF v_agent_share > 0 THEN
      INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
      VALUES (
        v_agent.id,
        'AGENT_COMMISSION',
        v_agent_share,
        'success',
        'Komisyon retrè ajan (20% frè)',
        jsonb_build_object('client_id', p_user_id, 'cash_amount', p_amount, 'fee', v_fee)
      );
    END IF;

    -- 80% frè → pwofi HatexCard (Kès Global / enterprise profit)
    IF v_hatex_share > 0 THEN
      INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
      VALUES (
        p_user_id,
        'AGENT_WITHDRAW_FEE',
        v_hatex_share,
        'success',
        'Frè HatexCard retrè ajan (80%)',
        jsonb_build_object(
          'agent_id', v_agent.id,
          'agent_code', trim(p_agent_code),
          'cash_amount', p_amount,
          'fee_total', v_fee,
          'agent_share', v_agent_share,
          'hatex_share', v_hatex_share
        )
      );
    END IF;

    RETURN json_build_object(
      'success', true,
      'is_agent', true,
      'agent_name', v_agent.full_name,
      'cash_amount', p_amount,
      'fee', v_fee,
      'agent_share', v_agent_share,
      'hatex_share', v_hatex_share,
      'total_debit', v_total_debit,
      'net_amount', v_net
    );
  END IF;

  -- ============================================================
  -- RETRÈ MONCASH / NATCASH / VIP (lojik egzistan)
  -- ============================================================
  BEGIN
    PERFORM public.hatex_assert_individual_spending_limit(p_user_id, v_account_type, p_amount, 'withdraw');
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
  END;

  IF COALESCE(v_balance, 0) < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase kòb sou kont ou pou montan sa a.');
  END IF;

  v_is_large := p_amount > 15000;
  v_fee := CASE WHEN v_is_large THEN 0 ELSE ROUND(p_amount * 0.05, 2) END;
  v_net := p_amount - v_fee;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_user_id;

  INSERT INTO public.withdrawals (user_id, amount, fee, net_amount, method, phone, user_email, status)
  VALUES (
    p_user_id, p_amount, v_fee, v_net,
    CASE WHEN v_is_large THEN 'VIP_LARGE_TRANSFER' ELSE p_method END,
    CASE WHEN v_is_large THEN 'Pral bay li bay Sèvis Kliyan' ELSE p_phone END,
    p_user_email, 'pending'
  )
  RETURNING id INTO v_withdrawal_id;

  RETURN json_build_object(
    'success', true, 'is_agent', false, 'is_large', v_is_large,
    'withdrawal_id', v_withdrawal_id, 'fee', v_fee, 'net_amount', v_net
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_wallet_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_wallet_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_wallet_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_wallet_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO service_role;
