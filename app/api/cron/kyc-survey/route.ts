import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronSecret } from '@/lib/security/cron-auth';
import { KYC_STATUS } from '@/lib/kyc/status';
import { buildKycSurveyEmailHtml, KYC_SURVEY_FROM } from '@/lib/kyc/survey';
import { generateSurveyToken } from '@/lib/kyc/survey-token';
import { isEmailConfigured, sendMail } from '@/lib/notify/email';

const BATCH_LIMIT = 80;
const TOKEN_TTL_DAYS = 14;

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://hatexcard.com'
  ).replace(/\/$/, '');
}

export async function GET(req: Request) {
  try {
    if (!verifyCronSecret(req)) {
      return new Response('Ou pa gen otorizasyon pou deklanche robo sa a.', { status: 401 });
    }

    if (!isEmailConfigured()) {
      return NextResponse.json({ error: 'BREVO_API_KEY manke.' }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const origin = appOrigin();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, kyc_status, account_status')
      .in('kyc_status', [KYC_STATUS.NOT_SUBMITTED, KYC_STATUS.REJECTED])
      .neq('account_status', 'suspended')
      .not('email', 'is', null)
      .limit(400);

    if (error) {
      console.error('kyc-survey cron query:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (candidates || []).filter((p) => {
      const email = String(p.email || '').trim();
      return email.includes('@');
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const profile of rows) {
      if (sent >= BATCH_LIMIT) break;

      const { data: lastSend } = await supabase
        .from('kyc_survey_sends')
        .select('sent_at')
        .eq('user_id', profile.id)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSend?.sent_at && lastSend.sent_at > cutoff) {
        skipped += 1;
        continue;
      }

      const { raw, hash } = generateSurveyToken();
      const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { error: tokenErr } = await supabase.from('kyc_survey_tokens').insert({
        user_id: profile.id,
        token_hash: hash,
        expires_at: expiresAt,
      });

      if (tokenErr) {
        console.error('kyc-survey token:', tokenErr.message);
        failed += 1;
        continue;
      }

      const feedbackUrl = `${origin}/kyc-feedback?t=${encodeURIComponent(raw)}`;
      const html = buildKycSurveyEmailHtml({
        fullName: profile.full_name || 'Kliyan',
        feedbackUrl,
        appOrigin: origin,
      });

      try {
        const result = await sendMail({
          to: String(profile.email).trim(),
          from: KYC_SURVEY_FROM,
          subject: 'HatexCard — Poukisa ou poko pase KYC? Nou la pou ede w',
          html,
          logLabel: 'kyc-survey-cron',
        });

        if (!result.ok) {
          console.error('kyc-survey mail:', result.message);
          failed += 1;
          continue;
        }

        await supabase.from('kyc_survey_sends').insert({
          user_id: profile.id,
          email_to: String(profile.email).trim(),
          resend_id: result.id || null,
        });
        sent += 1;
      } catch (e) {
        console.error('kyc-survey send exception:', e);
        failed += 1;
      }
    }

    return NextResponse.json({
      success: true,
      candidates: rows.length,
      sent,
      skipped_recent: skipped,
      failed,
      batch_limit: BATCH_LIMIT,
    });
  } catch (e: any) {
    console.error('kyc-survey cron:', e?.message);
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
