-- ============================================================
-- ⚠️⚠️⚠️ ATANSYON: SCRIPT DESTRIKTIF — PA GEN RETOU AN ARYE ⚠️⚠️⚠️
-- ============================================================
-- Script sa a fè 2 bagay:
--   1. Efase (DELETE) TOUT istorik ki alimante Kès Global admin nan
--      (transactions, deposits, withdrawals, transfers) — sa vle di
--      TOUT mesaj istorik frè (Ajan, Antrepriz, Kat, Depo, Retrè, Transfè)
--      ap disparèt nèt nan dashboard "Kès Global & Aktivite" a.
--   2. Mete balans TOUT kont (wallet_balance), TOUT kat (card_balance),
--      ak balans ajan (agent_balance) TOUT itilizatè yo a 0 HTG.
--
-- ‼️ SA A PA TOUCHE: kont itilizatè yo (email, modpas, KYC, wòl),
--    aplikasyon ajan/antrepriz ki deja apwouve, dokiman, kat vityèl
--    (nimewo/CVV/dat), abònman, fakti (invoices). Se SÈLMAN balans
--    ak istorik lajan (fee/transaction) ki efase.
--
-- 🛑 REKÒMANDASYON OBLIGATWA ANVAN OU KOURI L:
--    Fè yon backup baz done a anvan (Supabase Dashboard > Database >
--    Backups > "Create a backup now"), paske apre sa, DONE YO PÈDI NÈT.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Efase istorik ki alimante Kès Global admin nan
-- ------------------------------------------------------------
DELETE FROM transactions;
DELETE FROM deposits;
DELETE FROM withdrawals;
DELETE FROM transfers;

-- ------------------------------------------------------------
-- 2. Mete balans TOUT kont ak TOUT kat sou platfòm nan a 0 HTG
-- ------------------------------------------------------------
UPDATE profiles
SET
  wallet_balance = 0,
  card_balance = 0,
  agent_balance = 0;

COMMIT;

-- ============================================================
-- 📌 OPSYONÈL — Si ou vle netwaye ISTORIK KÒMAND/PEMAN MACHANN yo tou
-- (yo pa parèt dirèkteman nan "Kès Global" la, men se lòt istorik lajan
-- sou platfòm nan). Dekomante liy ki anba yo si ou vle efase yo tou:
-- ------------------------------------------------------------
-- DELETE FROM plugin_transactions;
-- DELETE FROM payment_requests;
-- DELETE FROM subscriptions_history;
-- DELETE FROM invoices;
-- ============================================================
