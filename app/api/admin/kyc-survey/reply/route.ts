import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { escapeHtml, KYC_SURVEY_FROM } from '@/lib/kyc/survey';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-kyc-survey-reply:${ip}`, 30, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const adminUser = await requireAdminUser();
  if (!adminUser || !(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
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
    .select('id, email, full_name')
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
    console.error('kyc-survey reply:', mailErr);
    return NextResponse.json({ error: 'Pa t kapab voye imèl la.' }, { status: 502 });
  }

  await db
    .from('kyc_survey_responses')
    .update({
      staff_replied_at: new Date().toISOString(),
      staff_reply_preview: message.slice(0, 280),
      staff_replied_by: adminUser.email || 'admin',
    })
    .eq('id', responseId);

  return NextResponse.json({ success: true });
}
