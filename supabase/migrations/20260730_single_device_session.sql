-- ============================================================
-- HATExCARD — Yon sèl aparèy konekte alafwa pa kont
-- ============================================================
-- Chak fwa yon kont konekte (modpas oswa PIN), sistèm nan jenere yon tag
-- alèatwa ("current_session_token") epi sere l sou pwofil la AK nan yon
-- cookie sou aparèy ki fèk konekte a. Middleware konpare tag aparèy la ak
-- tag pwofil la sou CHAK demann — si yo pa matche (paske yon lòt aparèy
-- konekte apre), sistèm nan dekonekte aparèy ansyen an otomatikman.
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_session_token TEXT;
