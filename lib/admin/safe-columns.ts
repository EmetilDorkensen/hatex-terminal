/** Kolòn pwofil ki ka chaje nan admin/workspace — pa gen secrets. */
export const ADMIN_PROFILE_SAFE_COLUMNS =
  'id, full_name, email, phone, wallet_balance, card_balance, agent_balance, account_status, account_type, kyc_status, kyc_fee_paid, is_activated, is_card_activated, is_agent, agent_tier, agent_capacity, agent_code, business_name, created_at, card_last4, exp_date, failed_otp_attempts';

export const KYC_PENDING_SAFE_COLUMNS =
  'id, full_name, email, phone, kyc_status, kyc_selfie, kyc_id_front, kyc_id_back, kyc_submitted_at, created_at, account_type, wallet_balance';

export const DEPOSIT_SAFE_COLUMNS =
  'id, user_id, user_email, amount, fee, total_to_pay, method, transaction_id, proof_img_1, proof_img_2, status, created_at';

export const WITHDRAWAL_SAFE_COLUMNS =
  'id, user_id, user_email, amount, fee, method, phone, agent_code, status, created_at, net_amount';
