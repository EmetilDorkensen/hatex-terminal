import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { KYC_SURVEY_QUESTIONS } from '@/lib/kyc/survey';
import { hashSurveyToken } from '@/lib/kyc/survey-token';
import { kycStatusLabel } from '@/lib/kyc/status';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`kyc-feedback-session:${ip}`, 40, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp tantativ.' }, { status: 429 });
  }

  const url = new URL(request.url);
  const t = url.searchParams.get('t') || '';
  if (!t || t.length < 16) {
    return NextResponse.json({ error: 'Token manke.' }, { status: 400 });
  }

  const hash = hashSurveyToken(t);
  const admin = createSupabaseAdminClient();
  const { data: token } = await admin
    .from('kyc_survey_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', hash)
    .maybeSingle();

  if (!token) {
    return NextResponse.json({ error: 'Lyen an pa valab.' }, { status: 404 });
  }
  if (token.used_at) {
    return NextResponse.json({ error: 'Ou deja reponn ak lyen sa a.', already_submitted: true }, { status: 410 });
  }
  if (new Date(token.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Lyen an ekspire. Tanpri tann pwochen email maten an.' }, { status: 410 });
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, kyc_status')
    .eq('id', token.user_id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Kont pa jwenn.' }, { status: 404 });
  }

  return NextResponse.json({
    full_name: profile.full_name || 'Kliyan',
    kyc_status: profile.kyc_status,
    kyc_status_label: kycStatusLabel(profile.kyc_status),
    questions: KYC_SURVEY_QUESTIONS,
  });
}
