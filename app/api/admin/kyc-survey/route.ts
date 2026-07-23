import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { kycStatusLabel } from '@/lib/kyc/status';
import { labelAnswers } from '@/lib/kyc/survey';
import { loadPendingKycWithLastSend } from '@/lib/kyc/survey-pending';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-kyc-survey:${ip}`, 40, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const adminUser = await requireAdminUser();
  if (!adminUser || !(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  }

  const db = createSupabaseAdminClient();

  const [{ data: responses }, pendingProfiles, { count: sendCount }] = await Promise.all([
    db
      .from('kyc_survey_responses')
      .select('id, user_id, answers, free_text, created_at, staff_replied_at, staff_reply_preview, staff_replied_by')
      .order('created_at', { ascending: false })
      .limit(200),
    loadPendingKycWithLastSend(db, 500),
    db.from('kyc_survey_sends').select('id', { count: 'exact', head: true }),
  ]);

  const userIds = Array.from(new Set((responses || []).map((r) => r.user_id)));

  const { data: profiles } = userIds.length
    ? await db.from('profiles').select('id, full_name, email, kyc_status').in('id', userIds)
    : { data: [] as any[] };

  const byId = new Map((profiles || []).map((p) => [p.id, p]));

  const enriched = (responses || []).map((r) => {
    const p = byId.get(r.user_id);
    return {
      ...r,
      full_name: p?.full_name || '—',
      email: p?.email || '—',
      kyc_status: p?.kyc_status,
      kyc_status_label: kycStatusLabel(p?.kyc_status),
      labeled_answers: labelAnswers((r.answers || {}) as Record<string, string | string[]>),
    };
  });

  return NextResponse.json({
    responses: enriched,
    pending_kyc: pendingProfiles,
    total_sends: sendCount || 0,
  });
}
