-- ============================================================
-- SEKIRITE + ENDÈKS POU TAB 'invoices' (Fonksyonalite Invoice/Fakti)
-- ============================================================
-- Tab 'invoices' la te deja egziste nan pwodwi a (itilize nan /terminal ak
-- /checkout-invoice/[id]) men li pa t gen okenn migrasyon swiv nan repo a.
-- Migrasyon sa a garanti estrikti a egziste, RLS aktive, epi règ aksè yo
-- byen defini pou anpeche yon itilizatè li/modifye fakti yon lòt moun.
--
-- Limit anti-fwod (aplike nan kòd, pa nan SQL, paske li bezwen kalkil
-- jounalye dinamik): Kont Endividyèl kanpe a 85,000 HTG/jou an fakti,
-- Kont Antrepriz ilimite. Gade lib/security/spending-limits.ts.
-- ============================================================

-- 1. Kreye tab la si li pa egziste ankò (idempotan — si li deja la, sa pa fè anyen).
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    client_email TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'expired')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Si tab la te deja egziste avan (san CHECK sou 'status'), n ap ranfòse
--    kolòn oblijatwa yo san n pa kraze done ki la deja.
ALTER TABLE invoices ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN amount SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 3. Endèks pou pèfòmans (istorik ak kalkil limit jounalye a pi rapid).
CREATE INDEX IF NOT EXISTS idx_invoices_owner_id ON invoices(owner_id);
CREATE INDEX IF NOT EXISTS idx_invoices_owner_created ON invoices(owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- 4. Aktive RLS (Row Level Security) — done sansib, chak moun dwe wè sèlman pwòp fakti li.
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- 5. Retire ansyen règ yo si yo egziste (pou n ka rekreye yo pwòp).
DROP POLICY IF EXISTS "invoices_owner_select" ON invoices;
DROP POLICY IF EXISTS "invoices_owner_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_owner_update" ON invoices;
DROP POLICY IF EXISTS "invoices_owner_delete" ON invoices;
DROP POLICY IF EXISTS "invoices_public_view_by_id" ON invoices;
DROP POLICY IF EXISTS "invoices_public_pay_update" ON invoices;

-- 6. Pwopriyetè fakti a (moun ki kreye l) ka kreye, modifye (anile), epi efase pwòp fakti li.
--    (Pa gen politik SELECT separe pou pwopriyetè a — règ #7 anba a kouvri tout lekti.)
CREATE POLICY "invoices_owner_insert" ON invoices
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "invoices_owner_update" ON invoices
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "invoices_owner_delete" ON invoices
    FOR DELETE USING (auth.uid() = owner_id);

-- 7. Paj peman piblik lan (/checkout-invoice/[id]) itilize kle anonim (san
--    koneksyon) pou l ka montre yon fakti espesifik bay kliyan an lè l gen
--    ID inik (UUID, pratikman enposib pou devine) an men.
--
--    ⚠️  NOTE SEKIRITE: Politik "true" anba a teknikman pèmèt nenpòt moun
--    ki gen kle anonim lan (kle sa a piblik nan kòd sit la — nòmal) fè yon
--    "select *" san filtre e wè TOUT fakti (imel + montan) tout moun.
--    Nou kenbe l konsa pou KOUNYE A paske paj checkout la ak /terminal
--    depann de aksè sa a san yo pa gen koneksyon itilizatè. Pwochèn etap
--    rekòmande pou ranfòse ankò: ranplase lekti dirèk sa a ak yon fonksyon
--    Postgres (RPC, SECURITY DEFINER) ki retounen SÈLMAN fakti ki matche
--    yon ID espesifik, pou anpeche nenpòt "dump" tab la an antye.
--    Ekri/modifye estati ('paid') se SÈLMAN edge function 'pay-invoice' a
--    (ki itilize service_role epi kontoune RLS) ki gen dwa fè sa — okenn
--    politik piblik UPDATE pa egziste isit la, kidonk pèsonn pa ka triche
--    make yon fakti 'paid' dirèkteman nan navigatè a.
CREATE POLICY "invoices_public_view_by_id" ON invoices
    FOR SELECT USING (true);

COMMENT ON TABLE invoices IS 'Fakti (payment requests) kliyan yo kreye pou mande lajan. Frè/limit jounalye aplike nan kòd (lib/security/spending-limits.ts): 85,000 HTG/jou pou kont endividyèl, ilimite pou kont Antrepriz.';
