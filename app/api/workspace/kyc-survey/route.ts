import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { assertFinanceOperatorWithGate } from '@/lib/admin/auth';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { KYC_STATUS, kycStatusLabel } from '@/lib/kyc/status';
import { escapeHtml, KYC_SURVEY_FROM, labelAnswers } from '@/lib/kyc/survey';

async function requireSupportStaff() {
  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user?.email) return { ok: false as const, status: 401, message: 'Ou dwe konekte.' };

  const gate = await assertFinanceOperatorWithGate(user.email);
  if (!gate.ok) {
    return { ok: false as const, status: 403, message: 'Aksè refize. Antre gate workspace/admin.' };
  }

  if (gate.role === 'staff') {
    const db = createSupabaseAdminClient();
    const { data: staff } = await db
      .from('staff_users')
      .select('role')
      .eq('email', user.email.trim().toLowerCase())
      .eq('status', 'active')
      .maybeSingle();
    if (!staff || !['support', 'super_admin'].includes(String(staff.role))) {
      return { ok: false as const, status: 403, message: 'Wòl ou pa gen dwa sou kesyonman KYC.' };
    }
  }

  return { ok: true as const, user };
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`ws-kyc-survey:${ip}`, 40, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const auth = await requireSupportStaff();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  const { data: responses } = await db
    .from('kyc_survey_responses')
    .select('id, user_id, answers, free_text, created_at, staff_replied_at, staff_reply_preview, staff_replied_by')
    .order('created_at', { ascending: false })
    .limit(200);

  const userIds = Array.from(new Set((responses || []).map((r) => r.user_id)));
  const { data: profiles } = userIds.length
    ? await db.from('profiles').select('id, full_name, email, kyc_status').in('id', userIds)
    : { data: [] as any[] };
  const byId = new Map((profiles || []).map((p) => [p.id, p]));

  const { data: pending } = await db
    .from('profiles')
    .select('id, full_name, email, kyc_status, created_at')
    .in('kyc_status', [KYC_STATUS.NOT_SUBMITTED, KYC_STATUS.REJECTED])
    .order('created_at', { ascending: false })
    .limit(200);

  return NextResponse.json({
    responses: (responses || []).map((r) => {
      const p = byId.get(r.user_id);
      return {
        ...r,
        full_name: p?.full_name || '—',
        email: p?.email || '—',
        kyc_status: p?.kyc_status,
        kyc_status_label: kycStatusLabel(p?.kyc_status),
        labeled_answers: labelAnswers((r.answers || {}) as Record<string, string | string[]>),
      };
    }),
    pending_kyc: (pending || []).map((p) => ({
      ...p,
      kyc_status_label: kycStatusLabel(p.kyc_status),
    })),
  });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`ws-kyc-survey-reply:${ip}`, 30, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const auth = await requireSupportStaff();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Sèvis imèl pa konfigire.' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const responseId = typeof body.response_id === 'string' ? body.response_id : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : '';
  if (!responseId || !message) {
    return NextResponse.json({ error: 'Mesaj oswa repons manke.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const { data: row } = await db
    .from('kyc_survey_responses')
    .select('id, user_id')
    .eq('id', responseId)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: 'Repons pa jwenn.' }, { status: 404 });
  }

  const { data: profile } = await db
    .from('profiles')
    .select('email, full_name')
    .eq('id', row.user_id)
    .single();
  if (!profile?.email) {
    return NextResponse.json({ error: 'Imèl kliyan pa jwenn.' }, { status: 404 });
  }

  const resend = new Resend(apiKey);
  const { error: mailErr } = await resend.emails.send({
    from: KYC_SURVEY_FROM,
    to: profile.email,
    subject: 'HatexCard Sipò — Repons sou kesyonman KYC ou',
    html: `<p><strong>Bonjou ${escapeHtml(profile.full_name || 'Kliyan')},</strong></p>
<p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
<p style="color:#64748b;font-size:12px;margin-top:24px;">Ekip Sipò HatexCard · WhatsApp +509 3720 1241</p>`,
  });

  if (mailErr) {
    return NextResponse.json({ error: 'Pa t kapab voye imèl la.' }, { status: 502 });
  }

  await db
    .from('kyc_survey_responses')
    .update({
      staff_replied_at: new Date().toISOString(),
      staff_reply_preview: message.slice(0, 280),
      staff_replied_by: auth.user.email || 'staff',
    })
    .eq('id', responseId);

  return NextResponse.json({ success: true });
}
