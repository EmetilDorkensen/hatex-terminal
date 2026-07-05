-- ============================================================
-- HATExCARD — Aplike Plafon Balans Maksimòm DIRÈKTEMAN nan RPC yo
-- ============================================================
-- Sa a se yon "CREATE OR REPLACE" ki rekonstwi de fonksyon ki DEJA egziste
-- nan baz done pwodiksyon an (`process_transfer_by_email` ak
-- `process_merchant_payment_with_card`), dapre kòd sous yo jan pwopriyetè
-- a te voye l. Nou kenbe EGZAKTMAN menm lojik ki te la deja, nou sèlman
-- AJOUTE yon verifikasyon plafon balans (105,000 HTG kont endividyèl /
-- 2,000,000 HTG kont antrepriz) AVAN nou kredite destinatè a.
--
-- Sa a ranfòse (nan baz done a menm, kote se pi solid, san risk kous)
-- pre-check ki te deja ajoute nan kòd TypeScript la (app/transfert/page.tsx
-- ak app/pay/[id]/page.tsx / app/api/direct-payment/route.ts). Si de
-- operasyon rive an menm tan pou menm destinatè, se RPC sa yo (isit la)
-- k ap gen dènye mo a, paske yo egzekite ATOMIKMAN nan baz done a.
--
-- ⚠️ Si plafon yo ta chanje pita nan lib/security/spending-limits.ts,
-- sonje mete ajou 105000 / 2000000 anba yo tou pou yo rete synchronize.
-- ============================================================

-- ------------------------------------------------------------
-- 1. process_transfer_by_email — Transfè P2P ant 2 kont HatexCard
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_transfer_by_email(
  p_sender_id UUID,
  p_receiver_email TEXT,
  p_amount NUMERIC
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
  v_receiver_balance NUMERIC;
  v_receiver_account_type TEXT;
  v_max_balance NUMERIC;
BEGIN
  -- Chèche moun k ap resevwa a nan profiles (ki gen email kounye a)
  SELECT id, full_name, wallet_balance, account_type
    INTO v_receiver_id, v_receiver_name, v_receiver_balance, v_receiver_account_type
  FROM public.profiles
  WHERE email = p_receiver_email;

  IF v_receiver_id IS NULL THEN
    RAISE EXCEPTION 'Kliyan sa a pa egziste nan HatexCard.';
  END IF;

  IF v_receiver_id = p_sender_id THEN
    RAISE EXCEPTION 'Ou pa ka voye kòb bay tèt ou.';
  END IF;

  -- Jwenn enfòmasyon moun k ap voye a
  SELECT full_name, email INTO v_sender_name, v_sender_email
  FROM public.profiles
  WHERE id = p_sender_id;

  -- Tcheke balans
  IF (SELECT wallet_balance FROM public.profiles WHERE id = p_sender_id) < p_amount THEN
    RAISE EXCEPTION 'Balans ou ensifizan.';
  END IF;

  -- 🚨 PLAFON BALANS MAKSIMÒM: kont Antrepriz (2,000,000 HTG) vs Endividyèl (105,000 HTG)
  v_max_balance := CASE WHEN v_receiver_account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_receiver_balance, 0) + p_amount) > v_max_balance THEN
    RAISE EXCEPTION 'Balans destinatè a ta depase limit maksimòm otorize a (% HTG).', v_max_balance;
  END IF;

  -- Operasyon Balans
  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_sender_id;
  UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE id = v_receiver_id;

  -- Antre nan istorik (Transactions)
  INSERT INTO public.transactions (user_id, user_email, amount, type, description, status)
  VALUES (p_sender_id, p_receiver_email, -p_amount, 'P2P', 'TRANSFÈ BAY: ' || v_receiver_name, 'success');

  INSERT INTO public.transactions (user_id, user_email, amount, type, description, status)
  VALUES (v_receiver_id, v_sender_email, p_amount, 'P2P', 'TRANSFÈ NAN MEN: ' || v_sender_name, 'success');

  RETURN v_receiver_id;
END;
$$;

-- ------------------------------------------------------------
-- 2. process_merchant_payment_with_card — Peman machann pa kat vityèl
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_merchant_payment_with_card(
  p_payment_id UUID,
  p_card_number TEXT,
  p_exp_date TEXT,
  p_cvv TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_buyer RECORD;
  v_merchant_balance NUMERIC;
  v_merchant_account_type TEXT;
  v_max_balance NUMERIC;
BEGIN
  SELECT * INTO v_payment FROM public.payment_requests WHERE id = p_payment_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Fakti sa a pa egziste.'); END IF;
  IF v_payment.status = 'completed' THEN RETURN json_build_object('success', false, 'message', 'Fakti sa a te deja peye.'); END IF;

  SELECT * INTO v_buyer FROM public.profiles
  WHERE REPLACE(card_number, ' ', '') = REPLACE(p_card_number, ' ', '')
  AND exp_date = p_exp_date AND cvv = p_cvv;

  IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Enfòmasyon kat la pa bon.'); END IF;

  -- 🚨 1. NOU TCHEKE BALANS KAT LA KOUNYEA 🚨
  IF COALESCE(v_buyer.card_balance, 0) < v_payment.amount THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase lajan sou kat ou pou peman sa a.');
  END IF;

  -- 🚨 2. PLAFON BALANS MAKSIMÒM pou machann k ap resevwa kòb la 🚨
  SELECT wallet_balance, account_type INTO v_merchant_balance, v_merchant_account_type
  FROM public.profiles WHERE id = v_payment.merchant_id;

  v_max_balance := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_merchant_balance, 0) + v_payment.amount) > v_max_balance THEN
    RETURN json_build_object('success', false, 'message', 'Balans machann nan ta depase limit maksimòm otorize a (' || v_max_balance || ' HTG).');
  END IF;

  -- 🚨 3. NOU KOUPE KÒB LA SOU KAT KLIYAN AN, EPI NOU METE L SOU WALLET MACHANN NAN 🚨
  UPDATE public.profiles SET card_balance = card_balance - v_payment.amount WHERE id = v_buyer.id;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + v_payment.amount WHERE id = v_payment.merchant_id;

  UPDATE public.payment_requests SET status = 'completed' WHERE id = p_payment_id;

  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (v_buyer.id, -v_payment.amount, 'MERCHANT_PAYMENT', 'Acha anliy - Kòmand #' || v_payment.order_id, 'success');

  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (v_payment.merchant_id, v_payment.amount, 'MERCHANT_RECEIPT', 'Peman Plugin WooCommerce - Kòmand #' || v_payment.order_id, 'success');

  RETURN json_build_object('success', true, 'message', 'Peman an reyisi!');
END;
$$;

-- ============================================================
-- ENPÒTAN: Apre migrasyon
-- - Kouri script sa a nan Supabase SQL Editor.
-- - Sa a ranplase (CREATE OR REPLACE) 2 fonksyon ki deja egziste yo san
--   kase okenn entegrasyon aktyèl (menm non fonksyon, menm paramèt).
-- - Pre-check TypeScript ki deja la nan app/transfert/page.tsx,
--   app/pay/[id]/page.tsx ak app/api/direct-payment/route.ts rete itil
--   (bay itilizatè a yon mesaj erè klè imedyatman), men se RPC sa yo
--   (isit la) k ap PWOTEJE balans lan reyèlman nan baz done a.
-- ============================================================
