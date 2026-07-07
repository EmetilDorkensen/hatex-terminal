-- ============================================================
-- HATExCARD — Jounal Odit Admin (server-side, pa manipilab pa kliyan)
-- ============================================================
-- `staff_activity_log` (migrasyon 20260710) deja jounalize aksyon
-- ANPLWAYE yo (espas travay), men Sipè Admin (`/admin`) pa t gen okenn
-- jounal odit — ni RLS pa t pèmèt li ekri nan `staff_activity_log` a
-- (tab la mare ak `staff_users`, Sipè Admin pa ladan l).
--
-- Tab sa a espesyalman pou aksyon Sipè Admin yo, epi li SÈLMAN modifyab
-- pa `service_role` (backend) — kliyan (menm Sipè Admin lan) pa ka ekri
-- ladan l dirèkteman depi navigatè a, sa fè jounal la pi fyab (li pase
-- pa yon API route sèvè ki verifye sesyon + gate anvan li ekri).
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details JSONB,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_audit_log_service_role_only" ON admin_audit_log;
CREATE POLICY "admin_audit_log_service_role_only"
    ON admin_audit_log
    FOR ALL
    USING (false)
    WITH CHECK (false);

COMMENT ON TABLE admin_audit_log IS 'Jounal odit sèvè-a-sèvè pou aksyon Sipè Admin yo (/admin) — sèlman service_role ka ekri/li, API route yo egzije sesyon admin + gate anvan yo ekri yon liy.';
