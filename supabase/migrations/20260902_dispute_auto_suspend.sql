-- ============================================================================
-- HATEXCARD — LITIJ MACHANN + SISPANSYON OTOMATIK (3 rapò) 
-- ============================================================================
-- Spec §5 (Prevansyon fwod):
--   • Achtè ka ouvri yon rapò (dispute) si yon machann pa bay sèvis la.
--   • Si yon machann gen 3 rapò ouvè, sistèm nan otomatikman:
--       1. pase kont li an 'suspended' (hatex_merchant_accounts + profiles)
--       2. dezaktive tout kle API l yo (hatex_api_keys)
--
-- Migrasyon ADITIF sèlman — pa touche okenn tab ki egziste.
-- ============================================================================

BEGIN;

-- ============================================================
-- 1. REJISTRÈ LITIJ (sous verite pou konte rapò yo)
-- ============================================================
-- Yon litij = yon lòd/tranzaksyon peye ki gen yon plent ouvè.
-- Kouvri de sistèm peman machann:
--   • plugin_transactions (Plugin/Checkout ansyen)
--   • hatex_payments      (Gateway v2 pasrèl)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hatex_merchant_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Ki tab/vrè tranzaksyon sa a refere a
  source_table TEXT NOT NULL CHECK (source_table IN ('plugin_transactions', 'hatex_payments')),
  source_id    TEXT NOT NULL,
  -- ID lòd machann lan wè (pou rechèch imen)
  order_id     TEXT NOT NULL,

  client_phone TEXT,
  client_email TEXT,

  reason     TEXT NOT NULL,
  proof_text TEXT,
  store_name TEXT,

  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'rejected', 'refunded')),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_note TEXT
);

-- Pa ka gen de litij pou menm tranzaksyon
CREATE UNIQUE INDEX IF NOT EXISTS idx_hmd_source
  ON public.hatex_merchant_disputes (source_table, source_id);

CREATE INDEX IF NOT EXISTS idx_hmd_merchant_open
  ON public.hatex_merchant_disputes (merchant_id, status, created_at DESC);

ALTER TABLE public.hatex_merchant_disputes ENABLE ROW LEVEL SECURITY;

-- Yon itilizatè wè sèlman pwòp litij li yo (kòm kliyan)
DROP POLICY IF EXISTS hmd_client_select ON public.hatex_merchant_disputes;
CREATE POLICY hmd_client_select ON public.hatex_merchant_disputes
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- ============================================================
-- 2. KOLÒN SISPANSYON OTOMATIK SOU KONT MACHANN
-- ============================================================

ALTER TABLE public.hatex_merchant_accounts
  ADD COLUMN IF NOT EXISTS dispute_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_auto_suspended_at TIMESTAMPTZ;

-- ============================================================
-- 3. FONKSYON: KONTE LITIJ OUVÈ YON MACHANN
-- ============================================================

CREATE OR REPLACE FUNCTION public.hx_count_open_merchant_disputes(p_merchant UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.hatex_merchant_disputes
  WHERE merchant_id = p_merchant AND status = 'open';
$$;

-- ============================================================
-- 4. FONKSYON: SISPANN MACHANN + REVOKE KLE (atomik)
-- ============================================================
-- Retounen TRUE si machann nan fèk sispann pa fonksyon sa a (1e fwa),
-- FALSE si li pa t rive sou papòt 3 litij oswa si li te deja sispann.

CREATE OR REPLACE FUNCTION public.hx_auto_suspend_fraud_merchant(p_merchant UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open_count INTEGER;
  v_profile_role TEXT;
  v_account_status TEXT;
  v_already_flagged TIMESTAMPTZ;
BEGIN
  v_open_count := public.hx_count_open_merchant_disputes(p_merchant);

  IF v_open_count < 3 THEN
    RETURN FALSE;
  END IF;

  -- Pa janm auto-sispann yon kont admin/superadmin
  SELECT COALESCE(role, 'client') INTO v_profile_role
  FROM public.profiles WHERE id = p_merchant;

  IF v_profile_role IN ('admin', 'superadmin', 'staff') THEN
    RETURN FALSE;
  END IF;

  -- Deja sispandi akòz fwod epi li poko re-aktive? Pa double-touche.
  -- (Si admin te re-aktive l pandan litij yo toujou ouvè, yon nouvo rapò
  --  ap sispann li ankò otomatikman.)
  SELECT status, dispute_auto_suspended_at
    INTO v_account_status, v_already_flagged
  FROM public.hatex_merchant_accounts
  WHERE user_id = p_merchant;

  IF v_account_status = 'suspended' AND v_already_flagged IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Sispann kont machann pasrèl la
  UPDATE public.hatex_merchant_accounts
  SET status = 'suspended',
      dispute_auto_suspended_at = now(),
      updated_at = now()
  WHERE user_id = p_merchant;

  -- 2. Sispann kont itilizatè a (menm jan ak admin ops)
  UPDATE public.profiles
  SET account_status = 'suspended'
  WHERE id = p_merchant
    AND COALESCE(role, 'client') NOT IN ('admin', 'superadmin', 'staff');

  -- 3. Dezaktive TOUT kle API pasrèl v2 (test + live)
  UPDATE public.hatex_api_keys
  SET is_active = FALSE,
      revoked_at = now()
  WHERE merchant_id = p_merchant
    AND is_active = TRUE;

  RETURN TRUE;
END;
$$;

-- Fonksyon sa yo fèt pou wout sèvè (service_role) sèlman, pa pou navigatè
REVOKE ALL ON FUNCTION public.hx_count_open_merchant_disputes(UUID) FROM PUBLIC, ANON, AUTHENTICATED;
GRANT EXECUTE ON FUNCTION public.hx_count_open_merchant_disputes(UUID) TO SERVICE_ROLE;

REVOKE ALL ON FUNCTION public.hx_auto_suspend_fraud_merchant(UUID) FROM PUBLIC, ANON, AUTHENTICATED;
GRANT EXECUTE ON FUNCTION public.hx_auto_suspend_fraud_merchant(UUID) TO SERVICE_ROLE;

COMMIT;
