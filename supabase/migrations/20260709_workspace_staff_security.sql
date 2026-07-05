-- ============================================================
-- HATExCARD — Sekirite Espas Travay Anplwaye (Workspace Access)
-- Kouri script sa a nan Supabase SQL Editor
-- ============================================================
-- Nouvo sistèm: pa gen okenn lyen "setup" nan imel anplwaye a ankò.
-- Anplwaye a itilize DIRÈKTEMAN kont kliyan nòmal li a (menm imel/menm
-- koneksyon Supabase Auth). Sou dashboard li, yon bouton "Aksè Espas
-- Travay" parèt si imel li nan tab staff_users. Premye fwa li klike,
-- sistèm nan mande l kreye yon MODPAS FÒ SPESYAL pou espas travay la —
-- modpas sa a hache (bcrypt) epi estoke apa nan staff_users, li pa
-- gen okenn rapò ak modpas kont kliyan nòmal li a.
-- ============================================================

-- 1) Kreye tab la si li pa egziste (idempotan si li deja la nan Supabase)
CREATE TABLE IF NOT EXISTS staff_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'support', -- super_admin | finance | compliance | support
    status TEXT NOT NULL DEFAULT 'pending', -- pending | active | revoked
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Nouvo kolòn pou modpas espas travay la ANKRIPTE (hash bcrypt) —
--    JAMEN estoke an klè. Ansyen kolòn 'workspace_password' (si li
--    egziste) pa itilize ankò pa okenn nouvo kòd; nou kite l pou istorik
--    men n ap efase valè li pou l pa trennen ansyen modpas an klè.
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS workspace_password_hash TEXT;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS workspace_password_set_at TIMESTAMPTZ;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS last_workspace_login_at TIMESTAMPTZ;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'staff_users' AND column_name = 'workspace_password'
    ) THEN
        UPDATE staff_users SET workspace_password = NULL WHERE workspace_password IS NOT NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_users_email ON staff_users(email);
CREATE INDEX IF NOT EXISTS idx_staff_users_status ON staff_users(status);

-- 3) RLS — done sansib (modpas hache, wòl entèn).
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enterprise_applications_select" ON staff_users;
DROP POLICY IF EXISTS "staff_users_select_own" ON staff_users;
DROP POLICY IF EXISTS "staff_users_admin_all" ON staff_users;
DROP POLICY IF EXISTS "staff_users_select" ON staff_users;
DROP POLICY IF EXISTS "staff_users_insert" ON staff_users;
DROP POLICY IF EXISTS "staff_users_update" ON staff_users;
DROP POLICY IF EXISTS "staff_users_delete" ON staff_users;

-- Chak anplwaye ka wè SÈLMAN pwòp liy pa li (pou dashboard ka verifye si
-- bouton "Aksè Espas Travay" la dwe parèt) — men li PA ka modifye anyen
-- dirèkteman (ekri sou workspace_password_hash sèlman pèmèt via API
-- serveur ki itilize service_role, gade routes /api/workspace/*).
CREATE POLICY "staff_users_select_own" ON staff_users
    FOR SELECT USING (lower(auth.jwt() ->> 'email') = lower(email));

-- Sipè Admin (adminhatexcard@gmail.com) gen kontwòl konplè (envite,
-- revoke) dirèkteman soti nan panno /admin.
CREATE POLICY "staff_users_admin_all" ON staff_users
    FOR ALL USING (lower(auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com')
    WITH CHECK (lower(auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com');

COMMENT ON COLUMN staff_users.workspace_password_hash IS 'Hash bcrypt (JAMEN modpas an klè) — ekri sèlman via /api/workspace/set-password ak service_role.';
