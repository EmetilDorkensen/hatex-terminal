-- ============================================================================
-- FAZ 4 — RLS sou tab finansye + revoke RPC peman kat depi navigatè
-- ============================================================================

-- Helper: admin oswa staff aktif
-- (menm modèl ak profiles RLS nan 20260734)

-- ============================================================
-- 1. TRANSACTIONS
-- ============================================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transactions_select_own ON public.transactions;
CREATE POLICY transactions_select_own ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS transactions_select_admin ON public.transactions;
CREATE POLICY transactions_select_admin ON public.transactions
  FOR SELECT USING ((auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com');

DROP POLICY IF EXISTS transactions_select_staff ON public.transactions;
CREATE POLICY transactions_select_staff ON public.transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE email = lower(auth.jwt() ->> 'email') AND status = 'active'
    )
  );

DROP POLICY IF EXISTS transactions_admin_all ON public.transactions;
CREATE POLICY transactions_admin_all ON public.transactions
  FOR ALL USING ((auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com');

DROP POLICY IF EXISTS transactions_staff_all ON public.transactions;
CREATE POLICY transactions_staff_all ON public.transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE email = lower(auth.jwt() ->> 'email') AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE email = lower(auth.jwt() ->> 'email') AND status = 'active'
    )
  );

-- ============================================================
-- 2. DEPOSITS
-- ============================================================
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deposits_select_own ON public.deposits;
CREATE POLICY deposits_select_own ON public.deposits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS deposits_insert_own ON public.deposits;
CREATE POLICY deposits_insert_own ON public.deposits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS deposits_admin_all ON public.deposits;
CREATE POLICY deposits_admin_all ON public.deposits
  FOR ALL USING ((auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com');

DROP POLICY IF EXISTS deposits_staff_all ON public.deposits;
CREATE POLICY deposits_staff_all ON public.deposits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE email = lower(auth.jwt() ->> 'email') AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE email = lower(auth.jwt() ->> 'email') AND status = 'active'
    )
  );

-- ============================================================
-- 3. WITHDRAWALS
-- ============================================================
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS withdrawals_select_own ON public.withdrawals;
CREATE POLICY withdrawals_select_own ON public.withdrawals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS withdrawals_admin_all ON public.withdrawals;
CREATE POLICY withdrawals_admin_all ON public.withdrawals
  FOR ALL USING ((auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com');

DROP POLICY IF EXISTS withdrawals_staff_all ON public.withdrawals;
CREATE POLICY withdrawals_staff_all ON public.withdrawals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE email = lower(auth.jwt() ->> 'email') AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE email = lower(auth.jwt() ->> 'email') AND status = 'active'
    )
  );

-- ============================================================
-- 4. Revoke peman kat depi navigatè (itilize /api/pay/[id]/pay)
-- ============================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'process_merchant_payment_with_card'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.process_merchant_payment_with_card(%s) FROM PUBLIC', r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.process_merchant_payment_with_card(%s) FROM anon', r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.process_merchant_payment_with_card(%s) FROM authenticated', r.args);
  END LOOP;
END $$;

-- ============================================================
-- 5. payment_requests — lekti piblik pou fakti (san done machann sansib)
-- ============================================================
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_requests_public_read ON public.payment_requests;
CREATE POLICY payment_requests_public_read ON public.payment_requests
  FOR SELECT USING (true);

-- ============================================================================
-- VERIFYE:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('transactions','deposits','withdrawals');
-- ============================================================================
