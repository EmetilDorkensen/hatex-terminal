-- ============================================================================
-- P2P: mete frè nan metadata tranzaksyon P2P (admin toujou gen TRANSFER_FEE pou kès)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_transfer_by_email(
  p_sender_id UUID,
  p_receiver_email TEXT,
  p_amount NUMERIC,
  p_fee NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receiver_id UUID;
  v_sender_name TEXT;
  v_receiver_name TEXT;
  v_sender_email TEXT;
  v_sender_status TEXT;
  v_sender_balance NUMERIC;
  v_receiver_balance NUMERIC;
  v_receiver_account_type TEXT;
  v_max_balance NUMERIC;
  v_fee NUMERIC;
  v_total_debit NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_sender_id THEN
    RAISE EXCEPTION 'Ou pa gen otorizasyon pou voye kòb sou non yon lòt moun.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montan an pa valab.';
  END IF;

  v_fee := public.hatex_transfer_fee(p_amount);
  v_total_debit := p_amount + v_fee;

  SELECT id, full_name, wallet_balance, account_type
    INTO v_receiver_id, v_receiver_name, v_receiver_balance, v_receiver_account_type
  FROM public.profiles
  WHERE email = lower(trim(p_receiver_email))
  FOR UPDATE;

  IF v_receiver_id IS NULL THEN
    RAISE EXCEPTION 'Kliyan sa a pa egziste nan HatexCard.';
  END IF;

  IF v_receiver_id = p_sender_id THEN
    RAISE EXCEPTION 'Ou pa ka voye kòb bay tèt ou.';
  END IF;

  SELECT full_name, email, wallet_balance, account_status
    INTO v_sender_name, v_sender_email, v_sender_balance, v_sender_status
  FROM public.profiles
  WHERE id = p_sender_id
  FOR UPDATE;

  IF v_sender_status = 'suspended' THEN
    RAISE EXCEPTION 'Kont ou a sispandi.';
  END IF;

  IF COALESCE(v_sender_balance, 0) < v_total_debit THEN
    RAISE EXCEPTION 'Balans ou ensifizan.';
  END IF;

  v_max_balance := CASE WHEN v_receiver_account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_receiver_balance, 0) + p_amount) > v_max_balance THEN
    RAISE EXCEPTION 'Balans destinatè a ta depase limit maksimòm otorize a (% HTG).', v_max_balance;
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - v_total_debit WHERE id = p_sender_id;
  UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE id = v_receiver_id;

  INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
  VALUES (
    p_sender_id,
    -p_amount,
    'P2P',
    'TRANSFÈ BAY: ' || COALESCE(v_receiver_name, 'KLIYAN'),
    'success',
    jsonb_build_object(
      'transfer_fee', v_fee,
      'total_debit', v_total_debit,
      'receiver_name', v_receiver_name
    )
  );

  INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
  VALUES (
    v_receiver_id,
    p_amount,
    'P2P',
    'TRANSFÈ NAN MEN: ' || COALESCE(v_sender_name, 'KLIYAN'),
    'success',
    jsonb_build_object('sender_name', v_sender_name)
  );

  IF v_fee > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description, status, metadata)
    VALUES (
      p_sender_id,
      -v_fee,
      'TRANSFER_FEE',
      'Frè transfè P2P',
      'success',
      jsonb_build_object('hidden_from_user', true, 'receiver_name', v_receiver_name)
    );
  END IF;

  RETURN v_receiver_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_transfer_by_email(UUID, TEXT, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_transfer_by_email(UUID, TEXT, NUMERIC, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_transfer_by_email(UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;
