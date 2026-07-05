import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { checkMerchantEligibility, ensureMerchantApiCredentials } from '@/lib/security/merchant-provisioning';

export async function requireEligibleMerchant() {
  const supabaseSession = await createSupabaseServerClient();
  const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();

  if (authErr || !user) {
    return { error: 'Ou dwe konekte sou kont ou.', status: 401 as const, user: null, profile: null, supabaseAdmin: null };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, kyc_status, is_card_activated, is_merchant, api_key, webhook_secret')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { error: 'Pwofil pa jwenn.', status: 404 as const, user: null, profile: null, supabaseAdmin: null };
  }

  const eligibility = checkMerchantEligibility(profile);
  if (!eligibility.eligible) {
    return { error: 'Kont ou poko elijib pou API devlopè a (KYC apwouve + kat aktive obligatwa).', status: 403 as const, user: null, profile: null, supabaseAdmin: null };
  }

  // Oto-pwovizyone sou sèvè a (RLS kliyan an pa ka modifye api_key dirèkteman).
  const provision = await ensureMerchantApiCredentials(supabaseAdmin, profile);
  const readyProfile = {
    ...profile,
    api_key: provision.api_key ?? profile.api_key,
    is_merchant: provision.is_merchant,
    webhook_secret: provision.webhook_secret ?? profile.webhook_secret,
  };

  if (!readyProfile.api_key) {
    return { error: 'Pa kapab pwovizyone kle API a. Kontakte sipò.', status: 403 as const, user: null, profile: null, supabaseAdmin: null };
  }

  return { error: null, status: 200 as const, user, profile: readyProfile, supabaseAdmin };
}
