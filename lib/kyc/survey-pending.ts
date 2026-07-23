import type { SupabaseClient } from '@supabase/supabase-js';
import { KYC_STATUS, kycStatusLabel } from '@/lib/kyc/status';

/** Lis kont san KYC + dènye fwa kesyonman voye. */
export async function loadPendingKycWithLastSend(db: SupabaseClient, limit = 500) {
  const { data: pendingProfiles } = await db
    .from('profiles')
    .select('id, full_name, email, kyc_status, created_at, account_status')
    .or(`kyc_status.eq.${KYC_STATUS.NOT_SUBMITTED},kyc_status.eq.${KYC_STATUS.REJECTED},kyc_status.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit);

  const ids = (pendingProfiles || []).map((p) => p.id);
  const lastByUser = new Map<string, string>();

  if (ids.length) {
    const { data: sends } = await db
      .from('kyc_survey_sends')
      .select('user_id, sent_at')
      .in('user_id', ids)
      .order('sent_at', { ascending: false });

    for (const s of sends || []) {
      if (!lastByUser.has(s.user_id)) {
        lastByUser.set(s.user_id, s.sent_at);
      }
    }
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  return (pendingProfiles || []).map((p) => {
    const last = lastByUser.get(p.id) || null;
    const lastMs = last ? new Date(last).getTime() : 0;
    return {
      ...p,
      kyc_status: p.kyc_status || KYC_STATUS.NOT_SUBMITTED,
      kyc_status_label: kycStatusLabel(p.kyc_status || KYC_STATUS.NOT_SUBMITTED),
      last_survey_sent_at: last,
      survey_sent_recently: lastMs > cutoff,
    };
  });
}
