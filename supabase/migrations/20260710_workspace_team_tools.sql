-- ============================================================
-- HATExCARD — Zouti Entèn Espas Travay (tankou Stripe/PayPal)
-- Kouri script sa a nan Supabase SQL Editor
-- ============================================================
-- 1) staff_messages     : chat entèn ant anplwaye yo (tout depatman)
-- 2) staff_activity_log : jounal odit — chak aksyon kritik yon anplwaye
--                         fè (apwouve depo, rejte KYC, elatriye) anrejistre
--                         pou responsablite ak sekirite (tankou "audit log"
--                         Stripe/PayPal genyen pou anplwaye entèn yo).
-- ============================================================

-- ------------------------------------------------------------
-- 1) STAFF_MESSAGES — Chat Ekip la
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
    sender_name TEXT,
    sender_role TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_messages_created_at ON staff_messages(created_at);

ALTER TABLE staff_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_messages_select" ON staff_messages;
DROP POLICY IF EXISTS "staff_messages_insert" ON staff_messages;

-- Chak anplwaye AKTIF (oswa Sipè Admin CEO) ka li tout mesaj ekip la.
CREATE POLICY "staff_messages_select" ON staff_messages
    FOR SELECT USING (
        lower(auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com'
        OR EXISTS (
            SELECT 1 FROM staff_users su
            WHERE lower(su.email) = lower(auth.jwt() ->> 'email') AND su.status = 'active'
        )
    );

-- Anplwaye a ka sèlman ekri kòm limenm (sender_id dwe matche pwòp liy li).
CREATE POLICY "staff_messages_insert" ON staff_messages
    FOR INSERT WITH CHECK (
        sender_id IN (
            SELECT id FROM staff_users
            WHERE lower(email) = lower(auth.jwt() ->> 'email') AND status = 'active'
        )
    );

-- ------------------------------------------------------------
-- 2) STAFF_ACTIVITY_LOG — Jounal Odit (Sekirite & Responsablite)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    staff_name TEXT,
    staff_role TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_activity_log_created_at ON staff_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_staff_activity_log_staff_id ON staff_activity_log(staff_id);

ALTER TABLE staff_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_activity_log_insert_own" ON staff_activity_log;
DROP POLICY IF EXISTS "staff_activity_log_select_super_admin" ON staff_activity_log;

-- Yon anplwaye ka SÈLMAN ekri yon liy odit ki mare ak pwòp non li (li pa
-- ka fabrike yon aksyon nan non yon lòt anplwaye).
CREATE POLICY "staff_activity_log_insert_own" ON staff_activity_log
    FOR INSERT WITH CHECK (
        staff_id IN (
            SELECT id FROM staff_users
            WHERE lower(email) = lower(auth.jwt() ->> 'email') AND status = 'active'
        )
    );

-- Sèlman Sipè Admin (CEO oswa wòl entèn 'super_admin') ka li jounal odit
-- la — se sipèvizyon, pa gen okenn anplwaye òdinè ki dwe wè aksyon lòt yo.
CREATE POLICY "staff_activity_log_select_super_admin" ON staff_activity_log
    FOR SELECT USING (
        lower(auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com'
        OR EXISTS (
            SELECT 1 FROM staff_users su
            WHERE lower(su.email) = lower(auth.jwt() ->> 'email')
              AND su.role = 'super_admin'
              AND su.status = 'active'
        )
    );

COMMENT ON TABLE staff_messages IS 'Chat entèn ant anplwaye Hatexcard yo (tout depatman) — pwoteje pa RLS, sèlman anplwaye aktif ka li/ekri.';
COMMENT ON TABLE staff_activity_log IS 'Jounal odit aksyon anplwaye yo (apwouve/rejte depo, retrè, KYC, ajan, antrepriz) — sèlman Sipè Admin ka konsilte l, pou responsablite ak sekirite.';
