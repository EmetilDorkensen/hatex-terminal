import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildStoredApiKeyFields,
  generateApiKeyToken,
  generateWebhookSecretToken,
  profileHasApiKey,
} from '@/lib/security/api-key';

// ============================================================================
// ELIJIBILITE & PWOVIZYON KREDANSYÈL API MACHANN
// ============================================================================
// Yon kont ka jwenn aksè API otomatikman SÈLMAN si TOUDE kondisyon sa yo vre:
//   1. KYC kont kliyan an APWOUVE nan tab profiles (kyc_status === 'approved')
//   2. Li peye frè aktivasyon kat la (is_card_activated === true)
//
// Kle API yo estoke HASH nan baz done (api_key_hash + api_key_prefix).
// Kle an klè retounen SÈLMAN yon sèl fwa lè li fèk jenere oswa lè li rotate.
// ============================================================================

export type MerchantEligibility = {
  eligible: boolean;
  missingKyc: boolean;
  missingCardActivation: boolean;
};

export type ProvisionResult = {
  /** Kle an klè — sèlman lè fèk jenere/rotate. */
  api_key: string | null;
  api_key_prefix: string | null;
  is_merchant: boolean;
  webhook_secret: string | null;
  provisioned: boolean;
  rotated: boolean;
  eligibility: MerchantEligibility;
};

type MerchantProfileLike = {
  id: string;
  kyc_status?: string | null;
  is_card_activated?: boolean | null;
  api_key?: string | null;
  api_key_hash?: string | null;
  api_key_prefix?: string | null;
  is_merchant?: boolean | null;
  webhook_secret?: string | null;
};

/** Menm kondisyon ak Dashboard/Terminal: KYC apwouve + kat aktive. */
export function canAccessTerminal(profile: MerchantProfileLike | null | undefined): boolean {
  return checkMerchantEligibility(profile).eligible;
}

export function checkMerchantEligibility(profile: MerchantProfileLike | null | undefined): MerchantEligibility {
  const kycOk = profile?.kyc_status === 'approved';
  const cardOk = profile?.is_card_activated === true;
  return {
    eligible: kycOk && cardOk,
    missingKyc: !kycOk,
    missingCardActivation: !cardOk,
  };
}

/**
 * Asire yon kont elijib gen tout kredansyèl API li yo. Si kont lan poko elijib,
 * pa jenere anyen. Si l elijib men manke youn nan kredansyèl yo, konplete sa ki
 * manke SÈLMAN (pa regenere yon api_key ki egziste deja pou pa kraze
 * entegrasyon k ap mache deja).
 */
export async function ensureMerchantApiCredentials(
  supabase: SupabaseClient,
  profile: MerchantProfileLike,
  options?: { rotateApiKey?: boolean }
): Promise<ProvisionResult> {
  const eligibility = checkMerchantEligibility(profile);

  const baseResult = {
    api_key: null as string | null,
    api_key_prefix: profile.api_key_prefix || null,
    is_merchant: profile.is_merchant === true,
    webhook_secret: profile.webhook_secret || null,
    provisioned: false,
    rotated: false,
    eligibility,
  };

  if (!eligibility.eligible) {
    return baseResult;
  }

  const hasApiKey = profileHasApiKey(profile);
  const rotate = options?.rotateApiKey === true;
  const needsNewApiKey = rotate || !hasApiKey;
  const needsWebhook = !profile.webhook_secret;
  const needsMerchantFlag = !profile.is_merchant;

  if (!needsNewApiKey && !needsWebhook && !needsMerchantFlag) {
    return baseResult;
  }

  const plainApiKey = needsNewApiKey ? generateApiKeyToken() : null;
  const webhookSecret = needsWebhook ? generateWebhookSecretToken() : profile.webhook_secret!;

  const updatePayload: Record<string, unknown> = {
    is_merchant: true,
  };

  if (needsWebhook) {
    updatePayload.webhook_secret = webhookSecret;
  }

  if (plainApiKey) {
    Object.assign(updatePayload, buildStoredApiKeyFields(plainApiKey));
  }

  const { error } = await supabase.from('profiles').update(updatePayload).eq('id', profile.id);

  if (error) {
    return baseResult;
  }

  return {
    api_key: plainApiKey,
    api_key_prefix: plainApiKey ? plainApiKey.slice(0, 12) : profile.api_key_prefix || null,
    is_merchant: true,
    webhook_secret: webhookSecret,
    provisioned: needsNewApiKey || needsWebhook || needsMerchantFlag,
    rotated: rotate && !!plainApiKey,
    eligibility,
  };
}
