-- ============================================================
-- HATExCARD — Kont Antrepriz (Enterprise) + Limit Depans
-- Kouri script sa a nan Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1) NOUVO KOLÒN SOU 'profiles'
-- ------------------------------------------------------------
-- account_type: 'individual' (default, otomatik pou tout kliyan)
--               'business'   (kont antrepriz, plis posiblite)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'individual';
UPDATE profiles SET account_type = 'individual' WHERE account_type IS NULL;

-- enterprise_status: 'none' | 'pending' | 'approved' | 'rejected'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS enterprise_status TEXT NOT NULL DEFAULT 'none';

-- Antrepo pou konnen konbyen frè antrepriz kliyan an te peye (odit)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS enterprise_fee_paid NUMERIC DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON profiles(account_type);
CREATE INDEX IF NOT EXISTS idx_profiles_enterprise_status ON profiles(enterprise_status);

-- ------------------------------------------------------------
-- 2) TAB 'enterprise_applications' — Aplikasyon Kont Antrepriz
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enterprise_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected

  business_name TEXT,
  business_reg_number TEXT,
  business_activity TEXT,

  -- Gwo dokiman biznis (anti-fwod) — lyen (URL) nan bucket 'enterprise_documents'
  patente_url TEXT,
  cif_url TEXT,
  business_registration_url TEXT,
  bank_statement_url TEXT,
  lease_doc_url TEXT,
  legal_rep_id_url TEXT,

  confidentiality_accepted BOOLEAN,
  confidentiality_accepted_at TIMESTAMPTZ,

  rejection_reason TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_applications_status ON enterprise_applications(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_applications_user_id ON enterprise_applications(user_id);

-- RLS: menm nivo aksè ak 'agent_applications' (kliyan gen aksè a pwòp
-- aplikasyon l, ekip admin/staff yo jere apwobasyon nan panno anplwaye a).
ALTER TABLE enterprise_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enterprise_applications_select" ON enterprise_applications;
CREATE POLICY "enterprise_applications_select" ON enterprise_applications
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "enterprise_applications_insert" ON enterprise_applications;
CREATE POLICY "enterprise_applications_insert" ON enterprise_applications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "enterprise_applications_update" ON enterprise_applications;
CREATE POLICY "enterprise_applications_update" ON enterprise_applications
  FOR UPDATE USING (true);

-- ------------------------------------------------------------
-- 3) BUCKET STORAGE POU DOKIMAN ANTREPRIZ YO
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('enterprise_documents', 'enterprise_documents', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- NÒT SEKIRITE / LIMIT (aplike nan kòd Next.js la, pa nan SQL):
--
--   KONT ENDIVIDYÈL (account_type = 'individual', defo pou tout moun):
--     - Transfè:  75,000 HTG / jou   •  250,000 HTG / mwa
--     - Retrè:    75,000 HTG / jou   •  250,000 HTG / mwa
--     - Kat/Acha: 75,000 HTG / jou   •  250,000 HTG / mwa
--
--   KONT ANTREPRIZ (account_type = 'business', apwouve pa admin):
--     - Transfè & Retrè: ILIMITE
--     - Kat/Acha: 100,000 HTG / jou  •  480,000 HTG / mwa
--
--   Frè aplikasyon pou pase nan kont Antrepriz: 49,000 HTG
--   (peye imedyatman lè yo soumèt dokiman yo; ranbouse si admin rejte).
--   Frè sa a se PWOFI HATEXCARD sèlman (anrejistre kòm tranzaksyon
--   'ENTERPRISE_FEE' epi konte nan Kès Global admin lan) — li PA janm
--   antre sou kont ajan (agent_balance) moun ki soumèt aplikasyon an.
--
--   Lè yon aplikasyon Antrepriz apwouve:
--     - profiles.account_type = 'business'
--     - profiles.enterprise_status = 'approved'
--     - Si kliyan an poko gen agent_status = 'approved', li resevwa
--       otomatikman yon kont Ajan PRO VID (agent_status='approved',
--       agent_tier='pro', agent_capacity=40000, agent_balance=0,
--       agent_guarantee_paid=0) san l pa oblije soumèt yon aplikasyon
--       ajan apa e san okenn kòb pa transfere sou kont ajan sa a.
--
--   Dokiman yo (patente_url, cif_url, elatriye) estoke kòm lyen (URL)
--   nan bucket 'enterprise_documents', menm jan ak 'agent_documents'.
--   Yo PA sekrè otantifikasyon, donk yo pa ankripte/hash.
-- ============================================================
