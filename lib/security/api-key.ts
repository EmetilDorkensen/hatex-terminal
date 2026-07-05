import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const API_KEY_PREFIX = 'hx_live_';
const WEBHOOK_PREFIX = 'whsec_';
export const API_KEY_PREFIX_DISPLAY_LEN = 12;

function getApiKeyPepper(): string {
  const secret =
    process.env.API_KEY_HASH_SECRET ||
    process.env.CARD_HASH_SECRET ||
    process.env.HATEX_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('API_KEY_HASH_SECRET (oswa CARD_HASH_SECRET) pa konfigire sou sèvè a.');
  }
  return secret;
}

export function generateApiKeyToken(): string {
  const bytes = crypto.randomBytes(24);
  return API_KEY_PREFIX + bytes.toString('hex');
}

export function generateWebhookSecretToken(): string {
  const bytes = crypto.randomBytes(24);
  return WEBHOOK_PREFIX + bytes.toString('hex');
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHmac('sha256', getApiKeyPepper()).update(apiKey.trim()).digest('hex');
}

export function apiKeyDisplayPrefix(apiKey: string): string {
  return apiKey.slice(0, API_KEY_PREFIX_DISPLAY_LEN);
}

export function maskApiKey(prefix: string | null | undefined): string {
  if (!prefix) return `${API_KEY_PREFIX}••••••••••••`;
  return `${prefix}${'•'.repeat(24)}`;
}

export type MerchantApiAuthRow = {
  id: string;
  full_name?: string | null;
  is_merchant?: boolean | null;
  account_status?: string | null;
  wallet_balance?: number | null;
  account_type?: string | null;
};

const MERCHANT_AUTH_SELECT =
  'id, full_name, is_merchant, account_status, wallet_balance, account_type, api_key_hash, api_key_prefix, api_key';

/** Mete hash + prefix epi efase kle an klè (migrasyon lazy). */
export async function upgradePlainApiKeyToHash(
  supabase: SupabaseClient,
  profileId: string,
  plainKey: string
): Promise<void> {
  await supabase
    .from('profiles')
    .update({
      api_key_hash: hashApiKey(plainKey),
      api_key_prefix: apiKeyDisplayPrefix(plainKey),
      api_key: null,
    })
    .eq('id', profileId);
}

/** Verifye yon Bearer kle API epi retounen pwofil machann nan. */
export async function authenticateMerchantApiKey(
  supabase: SupabaseClient,
  apiKey: string
): Promise<MerchantApiAuthRow | null> {
  const trimmed = apiKey.trim();
  if (!trimmed.startsWith(API_KEY_PREFIX)) return null;

  const hash = hashApiKey(trimmed);
  const { data: hashedRow } = await supabase
    .from('profiles')
    .select(MERCHANT_AUTH_SELECT)
    .eq('api_key_hash', hash)
    .maybeSingle();

  if (hashedRow?.is_merchant) {
    return hashedRow;
  }

  // Migrasyon lazy: ansyen kle an klè nan `api_key`
  const { data: legacyRow } = await supabase
    .from('profiles')
    .select(MERCHANT_AUTH_SELECT)
    .eq('api_key', trimmed)
    .maybeSingle();

  if (legacyRow?.is_merchant) {
    await upgradePlainApiKeyToHash(supabase, legacyRow.id, trimmed);
    return legacyRow;
  }

  return null;
}

export function profileHasApiKey(profile: {
  api_key_hash?: string | null;
  api_key?: string | null;
}): boolean {
  return !!(profile.api_key_hash || profile.api_key);
}

export type StoredApiKeyFields = {
  api_key_hash: string;
  api_key_prefix: string;
  api_key: null;
};

export function buildStoredApiKeyFields(plainApiKey: string): StoredApiKeyFields {
  return {
    api_key_hash: hashApiKey(plainApiKey),
    api_key_prefix: apiKeyDisplayPrefix(plainApiKey),
    api_key: null,
  };
}
