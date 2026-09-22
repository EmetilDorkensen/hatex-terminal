-- Patch rapid: gout trigger ki anpeche DROP kolòn ajan, epi gout kolòn yo.
-- Kouri sa a nan Supabase SQL Editor SI migrasyon konplè a deja echwe sou agent_capacity.
-- (Si w prefere, re-kouri tout 20260922_remove_agent_system.sql apre update a.)

BEGIN;

DROP TRIGGER IF EXISTS trg_hatex_enforce_pro_55k_capacity ON public.profiles;
DROP FUNCTION IF EXISTS public.hatex_enforce_pro_55k_capacity() CASCADE;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS agent_balance CASCADE,
  DROP COLUMN IF EXISTS agent_capacity CASCADE,
  DROP COLUMN IF EXISTS agent_guarantee_paid CASCADE,
  DROP COLUMN IF EXISTS agent_status CASCADE,
  DROP COLUMN IF EXISTS agent_tier CASCADE,
  DROP COLUMN IF EXISTS agent_code CASCADE,
  DROP COLUMN IF EXISTS is_agent CASCADE,
  DROP COLUMN IF EXISTS upgrade_status CASCADE;

COMMIT;
