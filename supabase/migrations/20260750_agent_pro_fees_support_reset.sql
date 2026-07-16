-- ============================================================================
-- 20260750: Fix ajan Pro + frè dinamik + reset kont + support RLS + agent_documents
-- ============================================================================

-- ============================================================
-- A. Bucket agent_documents (menm jan ak enterprise_documents)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agent_documents',
  'agent_documents',
  false,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760;

DROP POLICY IF EXISTS "agent_documents_insert" ON storage.objects;
CREATE POLICY "agent_documents_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agent_documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "agent_documents_select_own" ON storage.objects;
CREATE POLICY "agent_documents_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'agent_documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "agent_documents_admin_select" ON storage.objects;
CREATE POLICY "agent_documents_admin_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'agent_documents'
  AND (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(auth.jwt() ->> 'email') AND s.status = 'active'
    )
  )
);

-- ============================================================
-- B. Frè global + override pa kont (admin sèlman)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_fee_settings (
  fee_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  value NUMERIC NOT NULL CHECK (value >= 0),
  unit TEXT NOT NULL DEFAULT 'flat'
    CHECK (unit IN ('flat', 'per_1000', 'percent')),
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS public.account_fee_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fee_key TEXT NOT NULL REFERENCES public.platform_fee_settings(fee_key) ON DELETE CASCADE,
  value NUMERIC NOT NULL CHECK (value >= 0),
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  UNIQUE (user_id, fee_key)
);

CREATE INDEX IF NOT EXISTS idx_account_fee_overrides_user
  ON public.account_fee_overrides (user_id);

ALTER TABLE public.platform_fee_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_fee_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_fees_admin_select ON public.platform_fee_settings;
CREATE POLICY platform_fees_admin_select ON public.platform_fee_settings
  FOR SELECT USING (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
  );

DROP POLICY IF EXISTS account_fee_overrides_admin_select ON public.account_fee_overrides;
CREATE POLICY account_fee_overrides_admin_select ON public.account_fee_overrides
  FOR SELECT USING (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
  );

REVOKE ALL ON public.platform_fee_settings FROM anon, authenticated;
REVOKE ALL ON public.account_fee_overrides FROM anon, authenticated;
GRANT SELECT ON public.platform_fee_settings TO authenticated;
GRANT SELECT ON public.account_fee_overrides TO authenticated;
GRANT ALL ON public.platform_fee_settings TO service_role;
GRANT ALL ON public.account_fee_overrides TO service_role;

INSERT INTO public.platform_fee_settings (fee_key, label, value, unit, description) VALUES
  ('kyc_fee', 'Frè KYC', 1150, 'flat', 'Frè verifikasyon KYC (kat enkli)'),
  ('deposit_fee_percent', 'Frè depo kliyan', 5, 'percent', 'Frè sou depo (% )'),
  ('withdraw_fee_percent', 'Frè retrè MonCash/natcom', 5, 'percent', 'Frè sou retrè ki pa ajan'),
  ('transfer_fee_percent', 'Frè transfè P2P', 1, 'percent', 'Frè sou transfè ant kont'),
  ('agent_fee_per_1000', 'Frè ajan (aktivasyon/kapasite)', 7, 'per_1000', '7 HTG pou chak 1000 HTG'),
  ('agent_withdraw_fee_per_1000', 'Frè retrè kay ajan', 50, 'per_1000', '50 HTG pou chak 1000 HTG kach'),
  ('api_fee_per_1000', 'Frè API resevwa', 3, 'per_1000', '3 HTG pou chak 1000 HTG API'),
  ('enterprise_application_fee', 'Frè pasaj antrepriz', 49000, 'flat', 'Frè aplikasyon kont antrepriz'),
  ('card_activation_fee', 'Frè aktivasyon kat (legacy)', 0, 'flat', '0 si KYC enkli kat')
ON CONFLICT (fee_key) DO NOTHING;

-- Rezoud frè: override kont > global > default
CREATE OR REPLACE FUNCTION public.hatex_resolve_fee(
  p_fee_key TEXT,
  p_user_id UUID DEFAULT NULL,
  p_default NUMERIC DEFAULT 0
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val NUMERIC;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT value INTO v_val
    FROM public.account_fee_overrides
    WHERE user_id = p_user_id AND fee_key = p_fee_key;
    IF FOUND THEN
      RETURN COALESCE(v_val, 0);
    END IF;
  END IF;

  SELECT value INTO v_val
  FROM public.platform_fee_settings
  WHERE fee_key = p_fee_key;
  IF FOUND THEN
    RETURN COALESCE(v_val, p_default);
  END IF;

  RETURN COALESCE(p_default, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_resolve_fee(TEXT, UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hatex_resolve_fee(TEXT, UUID, NUMERIC) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.hatex_agent_fee(NUMERIC);
CREATE OR REPLACE FUNCTION public.hatex_agent_fee(p_amount NUMERIC, p_user_id UUID DEFAULT NULL)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  v_rate := public.hatex_resolve_fee('agent_fee_per_1000', p_user_id, 7);
  RETURN FLOOR((GREATEST(COALESCE(p_amount, 0), 0) / 1000.0) * v_rate);
END;
$$;

-- ============================================================
-- C. Aktivasyon ajan: aksepte 'pro' (alias standard)
-- ============================================================
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
  v_fee NUMERIC;
  v_total NUMERIC;
  v_max NUMERIC;
  v_tier TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  -- UI itilize 'pro'; ansyen RPC te mande 'standard'
  v_tier := CASE
    WHEN lower(trim(p_tier)) IN ('pro', 'standard') THEN 'pro'
    WHEN lower(trim(p_tier)) = 'premium' THEN 'premium'
    ELSE NULL
  END;
  IF v_tier IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Plan pa valab. Chwazi PRO oswa PREMIUM.');
  END IF;

  v_max := CASE WHEN v_tier = 'premium' THEN 110000 ELSE 40000 END;
  IF p_amount > v_max THEN
    RETURN json_build_object('success', false, 'message', 'Montan an depase kapasite maksimòm plan an.');
  END IF;

  v_fee := public.hatex_agent_fee(p_amount, p_user_id);
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
    agent_tier = v_tier
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (p_user_id, 'AGENT_GUARANTEE', -p_amount, 'success', 'Aktivasyon Ajan ' || upper(v_tier));
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (
    p_user_id, 'FEE', -v_fee, 'success',
    'Frè aktivasyon Ajan (' || public.hatex_resolve_fee('agent_fee_per_1000', p_user_id, 7) || ' HTG / 1000 HTG)'
  );

  RETURN json_build_object('success', true, 'fee', v_fee, 'tier', v_tier);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_agent_activation(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_agent_activation(UUID, NUMERIC, TEXT) TO authenticated, service_role;

-- Kapasite ajan: itilize frè dinamik + tier pro
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
  v_fee NUMERIC;
  v_total NUMERIC;
  v_capacity NUMERIC;
  v_tier TEXT;
  v_required NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Aksyon pa otorize.');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  SELECT wallet_balance, account_status, agent_capacity, agent_tier
  INTO v_wallet, v_status, v_capacity, v_tier
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;
  IF v_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'message', 'Kont ou a sispandi.');
  END IF;

  v_fee := public.hatex_agent_fee(p_amount, p_user_id);
  v_total := p_amount + v_fee;
  IF COALESCE(v_wallet, 0) < v_total THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa gen ase kòb sou Wallet ou.');
  END IF;

  v_required := CASE WHEN v_tier = 'premium' THEN 110000 ELSE 40000 END;
  IF (COALESCE(v_capacity, 0) + p_amount) > v_required THEN
    RETURN json_build_object('success', false, 'message', 'Ou ta depase kapasite maksimòm plan ou a.');
  END IF;

  UPDATE public.profiles SET
    wallet_balance = wallet_balance - v_total,
    agent_capacity = COALESCE(agent_capacity, 0) + p_amount,
    agent_balance = COALESCE(agent_balance, 0) + p_amount,
    agent_guarantee_paid = COALESCE(agent_guarantee_paid, 0) + p_amount
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (p_user_id, 'AGENT_CAPACITY', -p_amount, 'success', 'Ogmantasyon kapasite ajan');
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (p_user_id, 'FEE', -v_fee, 'success', 'Frè ogmantasyon kapasite ajan');

  RETURN json_build_object('success', true, 'fee', v_fee);
END;
$$;

-- ============================================================
-- D. Support tickets / messages — RLS pou staff repons
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'answered', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_staff_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_messages (ticket_id, created_at ASC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_tickets_select_own ON public.support_tickets;
CREATE POLICY support_tickets_select_own ON public.support_tickets
  FOR SELECT USING (
    auth.uid() = user_id
    OR lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(auth.jwt() ->> 'email') AND s.status = 'active'
    )
  );

DROP POLICY IF EXISTS support_tickets_insert_own ON public.support_tickets;
CREATE POLICY support_tickets_insert_own ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS support_tickets_update_staff ON public.support_tickets;
CREATE POLICY support_tickets_update_staff ON public.support_tickets
  FOR UPDATE USING (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(auth.jwt() ->> 'email') AND s.status = 'active'
    )
  );

DROP POLICY IF EXISTS support_messages_select ON public.support_messages;
CREATE POLICY support_messages_select ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
    OR lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(auth.jwt() ->> 'email') AND s.status = 'active'
    )
  );

DROP POLICY IF EXISTS support_messages_insert_client ON public.support_messages;
CREATE POLICY support_messages_insert_client ON public.support_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND is_staff_reply = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

-- Staff pa insert dirèkteman depi navigatè (API service_role) —
-- men yo ka li. Pa bay INSERT staff nan RLS pou anpeche spoofing.

-- ============================================================
-- E. Admin reset kont kliyan (kenbe KYC, retire ajan/antrepriz)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_reset_client_account(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize. Itilize API admin.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;

  -- Balans zewo — KYC rete
  UPDATE public.profiles SET
    wallet_balance = 0,
    card_balance = 0,
    agent_balance = 0,
    agent_capacity = 0,
    agent_guarantee_paid = 0,
    agent_status = NULL,
    agent_tier = NULL,
    agent_code = NULL,
    account_type = 'individual',
    business_name = NULL,
    enterprise_status = 'none'
  WHERE id = p_user_id;

  -- Rejte / anile aplikasyon ajan / antrepriz (si yo te apwouve oswa ap tann)
  UPDATE public.agent_applications
  SET status = 'rejected',
      rejection_reason = COALESCE(rejection_reason, 'Admin reyinisyalize kont lan')
  WHERE user_id = p_user_id AND status IN ('pending', 'approved');

  UPDATE public.enterprise_applications
  SET status = 'rejected',
      rejection_reason = COALESCE(rejection_reason, 'Admin reyinisyalize kont lan')
  WHERE user_id = p_user_id AND status IN ('pending', 'approved');

  INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
  VALUES (
    p_user_id,
    'ADMIN_ACCOUNT_RESET',
    0,
    'success',
    'Admin reyinisyalize kont lan (balans 0, ajan/antrepriz retire, KYC kenbe)',
    jsonb_build_object('kept_kyc', true)
  );

  RETURN json_build_object('success', true, 'user_id', p_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_client_account(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_client_account(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.hatex_agent_fee(NUMERIC, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hatex_agent_fee(NUMERIC, UUID) TO authenticated, service_role;

-- Frè API dinamik (3 HTG/1000 default, override pa admin)
CREATE OR REPLACE FUNCTION public.process_direct_card_payment(
  p_client_id UUID,
  p_merchant_id UUID,
  p_amount NUMERIC,
  p_order_id TEXT DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_merchant_name TEXT DEFAULT NULL,
  p_daily_received_so_far NUMERIC DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_card_balance NUMERIC;
  v_client_wallet_balance NUMERIC;
  v_client_status TEXT;
  v_merchant_balance NUMERIC;
  v_merchant_account_type TEXT;
  v_debit_source TEXT;
  v_max_balance NUMERIC;
  v_transaction_ref TEXT;
  v_client_tx_id UUID;
  v_merchant_tx_id UUID;
  v_daily_cap NUMERIC;
  v_api_fee NUMERIC;
  v_merchant_net NUMERIC;
  v_fee_rate NUMERIC;
  v_kes NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;
  IF p_client_id = p_merchant_id THEN
    RETURN json_build_object('success', false, 'message', 'Ou pa ka peye tèt ou.');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id IN (p_client_id, p_merchant_id) FOR UPDATE;

  SELECT card_balance, wallet_balance, account_status
  INTO v_client_card_balance, v_client_wallet_balance, v_client_status
  FROM public.profiles WHERE id = p_client_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kat kliyan an pa rekonèt.');
  END IF;
  IF v_client_status IS DISTINCT FROM 'active' THEN
    RETURN json_build_object('success', false, 'message', 'Kont kliyan an pa aktif.');
  END IF;

  IF COALESCE(v_client_card_balance, 0) >= p_amount THEN
    v_debit_source := 'card';
  ELSIF COALESCE(v_client_wallet_balance, 0) >= p_amount THEN
    v_debit_source := 'wallet';
  ELSE
    RETURN json_build_object(
      'success', false,
      'message',
      'Ou pa gen ase fon. Kat: ' || COALESCE(v_client_card_balance, 0)
        || ' HTG, Wallet: ' || COALESCE(v_client_wallet_balance, 0) || ' HTG.'
    );
  END IF;

  SELECT wallet_balance, account_type
  INTO v_merchant_balance, v_merchant_account_type
  FROM public.profiles WHERE id = p_merchant_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Machann pa jwenn.');
  END IF;

  v_fee_rate := public.hatex_resolve_fee('api_fee_per_1000', p_merchant_id, 3);
  v_api_fee := ROUND((p_amount / 1000.0) * v_fee_rate, 2);
  v_merchant_net := ROUND(p_amount - v_api_fee, 2);

  v_daily_cap := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 50000 END;
  IF (COALESCE(p_daily_received_so_far, 0) + p_amount) > v_daily_cap THEN
    RETURN json_build_object('success', false, 'message', 'Machann nan rive nan limit resepsyon jounalye a.');
  END IF;

  v_max_balance := CASE WHEN v_merchant_account_type = 'business' THEN 2000000 ELSE 105000 END;
  IF (COALESCE(v_merchant_balance, 0) + v_merchant_net) > v_max_balance THEN
    RETURN json_build_object(
      'success', false,
      'message',
      'Balans machann nan ta depase limit maksimòm otorize a (' || v_max_balance || ' HTG).'
    );
  END IF;

  IF v_debit_source = 'card' THEN
    UPDATE public.profiles SET card_balance = card_balance - p_amount WHERE id = p_client_id;
  ELSE
    UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_client_id;
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_merchant_net
  WHERE id = p_merchant_id;

  v_transaction_ref := 'HTX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
  VALUES (
    p_client_id, -p_amount, 'PURCHASE',
    'Peman sou entènèt: ' || COALESCE(p_merchant_name, 'Machann')
      || ' (Kòmand #' || COALESCE(NULLIF(p_order_id, ''), 'N/A') || ')',
    'success', v_transaction_ref || '-C',
    jsonb_build_object('source', 'public_api', 'debit_from', v_debit_source, 'tx_ref', v_transaction_ref, 'api_fee', v_api_fee)
  )
  RETURNING id INTO v_client_tx_id;

  INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
  VALUES (
    p_merchant_id, v_merchant_net, 'SALE',
    'Lavant sou entènèt (net) — frè API: ' || v_api_fee || ' HTG',
    'success', v_transaction_ref || '-M',
    jsonb_build_object('source', 'public_api', 'gross_amount', p_amount, 'api_fee', v_api_fee, 'net_amount', v_merchant_net)
  )
  RETURNING id INTO v_merchant_tx_id;

  IF v_api_fee > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description, status, reference_id, metadata)
    VALUES (
      p_merchant_id, -v_api_fee, 'API_FEE',
      'Frè API (' || v_fee_rate || ' HTG / 1 000)',
      'success', v_transaction_ref || '-F',
      jsonb_build_object('source', 'public_api', 'gross_amount', p_amount, 'fee_rate_per_1000', v_fee_rate)
    );
    BEGIN
      v_kes := public.hatex_credit_kes_global(v_api_fee, 'api_receive_fee');
    EXCEPTION WHEN OTHERS THEN
      v_kes := NULL;
    END;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Peman an fèt ak siksè!',
    'transaction_id', v_client_tx_id,
    'reference', v_transaction_ref,
    'merchant_transaction_id', v_merchant_tx_id,
    'debited_from', v_debit_source,
    'gross_amount', p_amount,
    'api_fee', v_api_fee,
    'net_amount', v_merchant_net,
    'kes_global_balance', v_kes
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_direct_card_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) TO service_role;
