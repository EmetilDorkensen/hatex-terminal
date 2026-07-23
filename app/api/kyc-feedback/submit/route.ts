import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { KYC_SURVEY_QUESTIONS, type KycSurveyAnswers } from '@/lib/kyc/survey';
import { hashSurveyToken } from '@/lib/kyc/survey-token';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`kyc-feedback-submit:${ip}`, 20, 3600);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Twòp tantativ. Eseye nan ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const t = typeof body.t === 'string' ? body.t.trim() : '';
  const freeText = typeof body.free_text === 'string' ? body.free_text.trim().slice(0, 2000) : '';
  const answersRaw = body.answers && typeof body.answers === 'object' ? body.answers : {};

  if (!t || t.length < 16) {
    return NextResponse.json({ error: 'Token manke.' }, { status: 400 });
  }

  const answers: KycSurveyAnswers = {};
  for (const q of KYC_SURVEY_QUESTIONS) {
    const val = (answersRaw as Record<string, unknown>)[q.id];
    if (q.type === 'single') {
      if (typeof val !== 'string' || !q.options.some((o) => o.value === val)) {
        return NextResponse.json({ error: `Repons manke: ${q.label}` }, { status: 400 });
      }
      answers[q.id] = val;
    } else {
      if (!Array.isArray(val) || val.length === 0) {
        return NextResponse.json({ error: `Chwazi omwen yon opsyon: ${q.label}` }, { status: 400 });
      }
      const allowed = new Set(q.options.map((o) => o.value));
      const clean = val.filter((v): v is string => typeof v === 'string' && allowed.has(v));
      if (!clean.length) {
        return NextResponse.json({ error: `Opsyon pa valab: ${q.label}` }, { status: 400 });
      }
      answers[q.id] = clean;
    }
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
    return NextResponse.json({ error: 'Ou deja reponn ak lyen sa a.' }, { status: 410 });
  }
  if (new Date(token.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Lyen an ekspire.' }, { status: 410 });
  }

  const { error: insertErr } = await admin.from('kyc_survey_responses').insert({
    user_id: token.user_id,
    answers,
    free_text: freeText || null,
  });

  if (insertErr) {
    console.error('kyc-feedback insert:', insertErr.message);
    return NextResponse.json({ error: 'Pa t kapab sove repons la.' }, { status: 500 });
  }

  await admin
    .from('kyc_survey_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', token.id);

  return NextResponse.json({
    success: true,
    message: 'Mèsi! Ekip sipò a pral li repons ou. Ou ka kontakte nou sou WhatsApp tou.',
  });
}
