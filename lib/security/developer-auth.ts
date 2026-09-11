import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { checkMerchantEligibility, ensureMerchantApiCredentials } from '@/lib/security/merchant-provisioning';
import { maskApiKey, profileHasApiKey } from '@/lib/security/api-key';

export async function requireEligibleMerchant() {
  const supabaseSession = await createSupabaseServerClient();
  const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();

  if (authErr || !user) {
    return { error: 'Ou dwe konekte sou kont ou.', status: 401 as const, user: null, profile: null, supabaseAdmin: null };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, kyc_status, is_merchant, api_key, api_key_hash, api_key_prefix, api_key_pk, api_key_pk_hash, api_key_pk_prefix, webhook_secret, api_key_mode')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { error: 'Pwofil pa jwenn.', status: 404 as const, user: null, profile: null, supabaseAdmin: null };
  }

  const eligibility = checkMerchantEligibility(profile);
  if (!eligibility.eligible) {
    return { error: 'Kont ou poko elijib pou API devlopè a (KYC apwouve obligatwa).', status: 403 as const, user: null, profile: null, supabaseAdmin: null };
  }

  const provision = await ensureMerchantApiCredentials(supabaseAdmin, profile);
  const readyProfile = {
    ...profile,
    is_merchant: provision.is_merchant,
    webhook_secret: provision.webhook_secret ?? profile.webhook_secret,
    api_key_prefix: provision.api_key_prefix ?? profile.api_key_prefix,
  };

  if (!profileHasApiKey(readyProfile) && !provision.api_key) {
    return { error: 'Pa kapab pwovizyone kle API a. Kontakte sipò.', status: 403 as const, user: null, profile: null, supabaseAdmin: null };
  }

  return { error: null, status: 200 as const, user, profile: readyProfile, supabaseAdmin };
}

export type MerchantApiKeyView = {
  api_key_prefix: string | null;
  api_key_masked: string;
  has_api_key: boolean;
  api_key_pk_prefix: string | null;
  api_key_pk: string | null;
};

export function toApiKeyView(profile: {
  api_key_prefix?: string | null;
  api_key_hash?: string | null;
  api_key?: string | null;
  api_key_pk_prefix?: string | null;
  api_key_pk?: string | null;
}): MerchantApiKeyView {
  return {
    api_key_prefix: profile.api_key_prefix || null,
    api_key_masked: maskApiKey(profile.api_key_prefix),
    has_api_key: profileHasApiKey(profile),
    api_key_pk_prefix: profile.api_key_pk_prefix || null,
    api_key_pk: profile.api_key_pk || null,
  };
}
