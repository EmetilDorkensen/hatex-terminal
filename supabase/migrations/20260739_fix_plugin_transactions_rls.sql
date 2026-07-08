-- ============================================================================
-- PATCH — fini 20260738 si li te echwe sou plugin_transactions
-- Kouri TOUT fichye sa a nan Supabase SQL Editor
-- ============================================================================

-- 1. Revoke process_direct_card_payment (repete pou asire)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'process_direct_card_payment'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(%s) FROM PUBLIC', r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(%s) FROM anon', r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.process_direct_card_payment(%s) FROM authenticated', r.args);
  END LOOP;
END $$;

-- 2. RLS plugin_transactions (kolòn kòrèk)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plugin_transactions') THEN
    EXECUTE 'ALTER TABLE public.plugin_transactions ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS plugin_tx_user_select ON public.plugin_transactions';
    EXECUTE 'DROP POLICY IF EXISTS plugin_tx_user_insert ON public.plugin_transactions';
    EXECUTE 'DROP POLICY IF EXISTS plugin_tx_merchant_select ON public.plugin_transactions';
    EXECUTE 'DROP POLICY IF EXISTS plugin_tx_client_select ON public.plugin_transactions';

    EXECUTE $policy$
      CREATE POLICY plugin_tx_merchant_select ON public.plugin_transactions
        FOR SELECT USING (auth.uid() = merchant_id)
    $policy$;

    EXECUTE $policy$
      CREATE POLICY plugin_tx_client_select ON public.plugin_transactions
        FOR SELECT USING (
          lower(COALESCE(customer_info->>'email', '')) = lower(COALESCE(auth.jwt() ->> 'email', ''))
          OR COALESCE(dispute_details->>'client_id', '') = auth.uid()::text
        )
    $policy$;
  END IF;
END $$;

-- ============================================================================
-- VERIFYE RPC (dwe sèlman postgres + service_role):
-- SELECT grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public'
--   AND routine_name = 'process_direct_card_payment';
--
-- VERIFYE RLS finansye (dwe tout true — soti nan 20260737):
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('deposits','transactions','withdrawals');
-- ============================================================================
