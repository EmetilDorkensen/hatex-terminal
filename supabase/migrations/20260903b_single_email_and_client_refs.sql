-- ============================================================================
-- 20260903b: Yon sèl chemen imèl fakti + client_ref opak pou chak kont
--
-- 1) Deaktive vye trigger DB "voye-invoice" (supabase_functions.http_request →
--    edge function resend-email). Kounye a se wout /api/invoices/notify sèl
--    k ap voye imèl fakti (kontwole pa aplikasyon an, gen share_token + sesyon
--    pwopriyetè a). Sa anpeche tou doub imèl apre deplwaman an.
--
-- 2) Chak pwofil jwenn yon client_ref opak inik. Referans sa a (receiver_ref)
--    anrejistre nan metadata chak peman (fakti / pwodwi / API machann) pou
--    sistèm nan ka idantifye rapidman kiyès k ap resevwa lajan an lè MonCash
--    aksepte oswa rejte yon peman.
-- ============================================================================

DROP TRIGGER IF EXISTS "voye-invoice" ON public.invoices;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_ref TEXT;

ALTER TABLE public.profiles
  ALTER COLUMN client_ref SET DEFAULT public.hatex_share_token();

UPDATE public.profiles
SET client_ref = public.hatex_share_token()
WHERE client_ref IS NULL OR client_ref = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_client_ref
  ON public.profiles (client_ref)
  WHERE client_ref IS NOT NULL;

COMMENT ON COLUMN public.profiles.client_ref IS
  'Ref opak inik chak kont ki resevwa lajan. Anrejistre kòm receiver_ref nan metadata peman yo pou retrase rapid machann lan.';
