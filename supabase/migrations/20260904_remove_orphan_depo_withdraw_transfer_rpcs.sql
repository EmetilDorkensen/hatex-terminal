-- ============================================================================
-- NETWAYAJ DEPO / RETRÈ / TRANSFER (fonksyon RPC òfelen)
-- ============================================================================
-- Tab depo/retrè/transfer yo deja te retire (20260776_drop_wallet_card_agent
-- ak 20260784_drop_legacy_wallet_tables). Sa a retire tout fonksyon RPC ki
-- te sèvi sèlman ak fonksyonalite sa yo (retrè balans, depo, P2P transfer,
-- frè transfè, pwofi biznis ki te depann de tab retire yo).
--
-- NOT: kòd la (pages, API routes, imèl depo/retrè) retire nan menm fason;
-- pa gen okenn kòd ki rele fonksyon sa yo ankò.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'admin_approve_deposit',
        'admin_complete_withdrawal',
        'admin_reject_finance_item',
        'confirm_deposit_manual',
        'create_deposit_request',
        'hatex_assert_withdraw_rules',
        'hatex_business_profit_ledger_move',
        'hatex_business_profit_withdraw',
        'hatex_lookup_transfer_recipient',
        'hatex_sum_p2p_sent_since',
        'hatex_sum_withdrawn_since',
        'hatex_transfer_fee',
        'p2p_transfer',
        'process_agent_client_deposit',
        'process_deposit',
        'process_payment_transfer',
        'process_transfer_by_email',
        'process_wallet_withdrawal',
        'transfer_payment',
        'transfer_wallet_to_card',
        'trg_business_profit_deposit_fee',
        'trg_business_profit_tx_fee',
        'trg_business_profit_withdrawal_fee'
      )
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
END $$;

COMMIT;
