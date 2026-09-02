import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildStoredApiKeyFields,
  buildStoredPublishableKeyFields,
  generateApiKeyToken,
  generatePublishableKeyToken,
  generateWebhookSecretToken,
  profileHasApiKey,
} from '@/lib/security/api-key';

// ============================================================================
// ELIJIBILITE & PWOVIZYON KREDANSYÈL API MACHANN
// ============================================================================
// Yon kont ka jwenn aksè API / fakti SÈLMAN si:
//   1. KYC apwouve (kyc_status === 'approved')
//
// Kle API yo estoke HASH nan baz done (api_key_hash + api_key_prefix).
// Kle an klè retounen SÈLMAN yon sèl fwa lè li fèk jenere oswa lè li rotate.
// Chak machann gen DE kalite kle, menm jan ak Stripe:
//   • Secret key (hx_live_...) — sèlman sou sèvè, janm ekspoze.
//   • Publishable key (pk_live_...) — san danje, ka parèt nan frontend/checkout.
// ============================================================================

export type MerchantEligibility = {
  eligible: boolean;
  missingKyc: boolean;
  /** @deprecated Toujou false — frè 525 retire */
  missingCardActivation: boolean;
};

export type ProvisionResult = {
  /** Kle an klè — sèlman lè fèk jenere/rotate. */
  api_key: string | null;
  api_key_prefix: string | null;
  /** Publishable key an klè — EKSPOZE (pk_...), san danje frontend. */
  api_key_pk: string | null;
  api_key_pk_prefix: string | null;
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
  features_unlock_paid?: boolean | null;
  api_key?: string | null;
  api_key_hash?: string | null;
  api_key_prefix?: string | null;
  api_key_pk?: string | null;
  api_key_pk_hash?: string | null;
  api_key_pk_prefix?: string | null;
  is_merchant?: boolean | null;
  webhook_secret?: string | null;
  plan?: string | null;
};

/** Menm kondisyon ak Dashboard: KYC apwouve = debloke. */
export function canAccessTerminal(profile: MerchantProfileLike | null | undefined): boolean {
  return checkMerchantEligibility(profile).eligible;
}

export function checkMerchantEligibility(profile: MerchantProfileLike | null | undefined): MerchantEligibility {
  const kycOk = profile?.kyc_status === 'approved';
  const hasPlan = profile?.plan === 'free' || profile?.plan === 'capacity' || profile?.plan === 'premium';
  return {
    eligible: hasPlan || kycOk,
    missingKyc: !kycOk,
    missingCardActivation: false,
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
    api_key_pk: profile.api_key_pk || null,
    api_key_pk_prefix: profile.api_key_pk_prefix || null,
    is_merchant: profile.is_merchant === true,
    webhook_secret: null as string | null, // reveal-once sèlman
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
  const needsPublishable = !profile.api_key_pk_hash;
  const needsWebhook = !profile.webhook_secret;
  const needsMerchantFlag = !profile.is_merchant;

  if (!needsNewApiKey && !needsPublishable && !needsWebhook && !needsMerchantFlag) {
    return baseResult;
  }

  const plainApiKey = needsNewApiKey ? generateApiKeyToken() : null;
  const plainPublishableKey = needsPublishable ? generatePublishableKeyToken() : null;
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

  if (plainPublishableKey) {
    Object.assign(updatePayload, buildStoredPublishableKeyFields(plainPublishableKey));
  }

  const { error } = await supabase.from('profiles').update(updatePayload).eq('id', profile.id);

  if (error) {
    return baseResult;
  }

  return {
    api_key: plainApiKey,
    api_key_prefix: plainApiKey ? plainApiKey.slice(0, 12) : profile.api_key_prefix || null,
    api_key_pk: plainPublishableKey || profile.api_key_pk || null,
    api_key_pk_prefix: plainPublishableKey ? plainPublishableKey.slice(0, 12) : profile.api_key_pk_prefix || null,
    is_merchant: true,
    webhook_secret: needsWebhook ? webhookSecret : null,
    provisioned: needsNewApiKey || needsPublishable || needsWebhook || needsMerchantFlag,
    rotated: rotate && !!plainApiKey,
    eligibility,
  };
}
