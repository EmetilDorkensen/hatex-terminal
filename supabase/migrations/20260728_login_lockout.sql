-- ============================================================
-- HATExCARD — Lockout modpas pou koneksyon (defans kont brute-force)
-- ============================================================
-- Jiskaprezan, koneksyon ak modpas te sèlman pwoteje pa yon rate-limit
-- pa ADRÈS IP (`login-guard`). Sa a ajoute yon dezyèm kouch: chak KONT
-- (pa email) kounye a gen pwòp konte echèk pa li, menm jan ak PIN nan
-- (`pin_locked_until` / `failed_pin_attempts`) — sa anpeche yon atakè
-- eseye modpas plizyè fwa sou YON SÈL kont depi plizyè adrès IP diferan.
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_locked_until TIMESTAMPTZ;

-- ============================================================
-- ENPÒTAN: Apre migrasyon
-- - Kouri script sa a nan Supabase Dashboard > SQL Editor.
-- - Opsyonèl: mete TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY nan Vercel
--   pou aktive CAPTCHA (Cloudflare Turnstile) apre plizyè tantativ echwe.
--   Si yo pa konfigire, sistèm nan kontinye fonksyone san CAPTCHA — se
--   lockout pa kont + rate limit pa IP ki pwoteje.
-- ============================================================
