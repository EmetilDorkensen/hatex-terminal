-- ============================================================
-- HATExCARD — Ranfòsman Verifikasyon Ajan (Anti-Fwod)
-- Kouri script sa a nan Supabase SQL Editor
-- ============================================================

-- Dokiman & chan verifikasyon siplemantè pou tout tyè (PRO ak PREMIUM)
ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS selfie_with_id_url TEXT;
ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS id_expiry_date DATE;
ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS address_proof_date DATE;
ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS reference_name TEXT;
ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS reference_phone TEXT;

-- Dokiman siplemantè obligatwa sèlman pou PREMIUM
ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS criminal_record_url TEXT;
ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS bank_statement_url TEXT;
ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS lease_doc_url TEXT;
ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS confidentiality_accepted BOOLEAN;
ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS confidentiality_accepted_at TIMESTAMPTZ;

-- Endèks pou rechèch/rapò pi rapid pou Konfòmite
CREATE INDEX IF NOT EXISTS idx_agent_applications_id_expiry ON agent_applications(id_expiry_date);
CREATE INDEX IF NOT EXISTS idx_agent_applications_status_tier ON agent_applications(status, tier);

-- ============================================================
-- NÒT SEKIRITE
-- - Dokiman yo (id_doc_url, selfie_with_id_url, criminal_record_url, elatriye)
--   estoke kòm lyen (URL) nan bucket Supabase Storage 'agent_documents',
--   menm jan ak dokiman KYC ki te deja egziste. Yo PA sekrè otantifikasyon
--   (kòm PIN oswa modpas) — yo se prèv pou Konfòmite verifye, donk yo pa
--   ankripte/hash; yo pwoteje pa kontwòl aksè bucket la (RLS/prive si posib).
-- - reference_name / reference_phone se enfòmasyon kontak Konfòmite dwe ka
--   li ak itilize pou rele moun nan — yo PA hash tou (yon hash ta anpeche
--   admin sèvi ak enfòmasyon an pou rele referans lan).
-- - Sèl bagay ki bezwen hash se sekrè otantifikasyon (PIN, kat/CVV) — sa
--   deja fèt nan migrasyon 20260701_security_hardening.sql.
-- ============================================================
