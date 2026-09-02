import type { SupabaseClient } from '@supabase/supabase-js';

/** Dosye KYC soumèt / an revizyon / apwouve — ka peye abonnman. */
export async function hasSubmittedKyc(
  admin: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: profile } = await admin
    .from('profiles')
    .select('kyc_status')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.kyc_status === 'approved' || profile?.kyc_status === 'pending') {
    return true;
  }

  const { data: app } = await admin
    .from('hatex_kyc_applications')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['submitted', 'in_review', 'approved'])
    .limit(1)
    .maybeSingle();

  return Boolean(app);
}
