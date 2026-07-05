import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { checkMerchantEligibility } from '@/lib/security/merchant-provisioning';

export async function requireEligibleMerchant() {
  const supabaseSession = await createSupabaseServerClient();
  const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();

  if (authErr || !user) {
    return { error: 'Ou dwe konekte sou kont ou.', status: 401 as const, user: null, profile: null, supabaseAdmin: null };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, kyc_status, is_card_activated, is_merchant, api_key')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { error: 'Pwofil pa jwenn.', status: 404 as const, user: null, profile: null, supabaseAdmin: null };
  }

  const eligibility = checkMerchantEligibility(profile);
  if (!eligibility.eligible || !profile.is_merchant) {
    return { error: 'Kont ou poko elijib pou API devlopè a (KYC apwouve + kat aktive obligatwa).', status: 403 as const, user: null, profile: null, supabaseAdmin: null };
  }

  return { error: null, status: 200 as const, user, profile, supabaseAdmin };
}
