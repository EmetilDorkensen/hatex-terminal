-- ============================================================================
-- SEKIRIZE increment_merchant_balance — retire aksè kliyan/anon
-- ============================================================================
-- Verifye ou te wè: PUBLIC, anon, authenticated tout gen EXECUTE.
-- Sa vle di nenpòt moun konekte te ka rele fonksyon an pou ogmante balans.
-- Apre migrasyon sa a, sèlman service_role (cron/sèvè) ka rele l.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.increment_merchant_balance(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_merchant_balance(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_merchant_balance(uuid, integer) FROM authenticated;

-- Si gen lòt overload (eg. numeric olye de integer), retire yo tou:
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'increment_merchant_balance'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.increment_merchant_balance(%s) FROM PUBLIC',
      r.args
    );
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.increment_merchant_balance(%s) FROM anon',
      r.args
    );
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.increment_merchant_balance(%s) FROM authenticated',
      r.args
    );
  END LOOP;
END $$;

-- ============================================================================
-- VERIFYE — dwe sèlman service_role (ak postgres) ki gen EXECUTE:
-- SELECT grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public' AND routine_name = 'increment_merchant_balance';
-- ============================================================================
