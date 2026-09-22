-- Fin retire kolòn ajan + trigger (san manyen storage.objects).
-- Kouri sa a kounye a nan Supabase SQL Editor.

BEGIN;

DROP TRIGGER IF EXISTS trg_hatex_enforce_pro_55k_capacity ON public.profiles;
DROP FUNCTION IF EXISTS public.hatex_enforce_pro_55k_capacity() CASCADE;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND NOT t.tgisinternal
      AND (
        pg_get_triggerdef(t.oid) ILIKE '%agent_capacity%'
        OR pg_get_triggerdef(t.oid) ILIKE '%agent_balance%'
        OR pg_get_triggerdef(t.oid) ILIKE '%agent_tier%'
        OR pg_get_triggerdef(t.oid) ILIKE '%agent_status%'
        OR pg_get_triggerdef(t.oid) ILIKE '%agent_code%'
        OR pg_get_triggerdef(t.oid) ILIKE '%agent_guarantee%'
        OR pg_get_triggerdef(t.oid) ILIKE '%is_agent%'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.profiles', r.tgname);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS agent_balance CASCADE,
  DROP COLUMN IF EXISTS agent_capacity CASCADE,
  DROP COLUMN IF EXISTS agent_guarantee_paid CASCADE,
  DROP COLUMN IF EXISTS agent_status CASCADE,
  DROP COLUMN IF EXISTS agent_tier CASCADE,
  DROP COLUMN IF EXISTS agent_code CASCADE,
  DROP COLUMN IF EXISTS is_agent CASCADE,
  DROP COLUMN IF EXISTS upgrade_status CASCADE;

-- Frè / limit ajan nan konfig
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_fees') THEN
    DELETE FROM public.platform_fees
    WHERE fee_key IN ('agent_fee_per_1000', 'agent_withdraw_fee_per_1000');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_limits') THEN
    DELETE FROM public.platform_limits
    WHERE limit_key IN ('agent_pro_capacity', 'agent_premium_capacity', 'agent_withdraw_share_rate');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
