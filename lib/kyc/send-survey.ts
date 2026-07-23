import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { KYC_STATUS } from '@/lib/kyc/status';
import { buildKycSurveyEmailHtml, KYC_SURVEY_FROM } from '@/lib/kyc/survey';
import { generateSurveyToken } from '@/lib/kyc/survey-token';

const TOKEN_TTL_DAYS = 14;

export function surveyAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://hatexcard.com'
  ).replace(/\/$/, '');
}

export type SendSurveyResult =
  | { success: true; email: string; resend_id?: string | null; already_recent?: boolean }
  | { success: false; error: string; status: number };

/**
 * Voye email kesyonman KYC bay yon sèl itilizatè.
 * force=true: staff/admin ka renvoy menm si deja voye nan 24h.
 */
export async function sendKycSurveyToUser(
  db: SupabaseClient,
  userId: string,
  options?: { force?: boolean }
): Promise<SendSurveyResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Sèvis imèl pa konfigire.', status: 500 };
  }

  const { data: profile } = await db
    .from('profiles')
    .select('id, email, full_name, kyc_status, account_status')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return { success: false, error: 'Kliyan pa jwenn.', status: 404 };
  }

  const email = String(profile.email || '').trim();
  if (!email.includes('@')) {
    return { success: false, error: 'Kliyan sa a pa gen imèl valid.', status: 400 };
  }

  if (profile.account_status === 'suspended') {
    return { success: false, error: 'Kont sa a sispandi.', status: 400 };
  }

  const status = profile.kyc_status || KYC_STATUS.NOT_SUBMITTED;
  if (status === KYC_STATUS.APPROVED || status === KYC_STATUS.PENDING) {
    return {
      success: false,
      error:
        status === KYC_STATUS.APPROVED
          ? 'Kliyan sa a deja pase KYC.'
          : 'KYC deja soumèt (nan revizyon). Pa bezwen kesyonman.',
      status: 400,
    };
  }

  if (!options?.force) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: lastSend } = await db
      .from('kyc_survey_sends')
      .select('sent_at')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSend?.sent_at && lastSend.sent_at > cutoff) {
      return {
        success: true,
        email,
        already_recent: true,
      };
    }
  }

  const { raw, hash } = generateSurveyToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: tokenErr } = await db.from('kyc_survey_tokens').insert({
    user_id: userId,
    token_hash: hash,
    expires_at: expiresAt,
  });

  if (tokenErr) {
    console.error('send survey token:', tokenErr.message);
    return { success: false, error: 'Pa t kapab kreye lyen kesyonman.', status: 500 };
  }

  const origin = surveyAppOrigin();
  const feedbackUrl = `${origin}/kyc-feedback?t=${encodeURIComponent(raw)}`;
  const html = buildKycSurveyEmailHtml({
    fullName: profile.full_name || 'Kliyan',
    feedbackUrl,
    appOrigin: origin,
  });

  const resend = new Resend(apiKey);
  const { data: mailData, error: mailErr } = await resend.emails.send({
    from: KYC_SURVEY_FROM,
    to: email,
    subject: 'HatexCard — Poukisa ou poko pase KYC? Nou la pou ede w',
    html,
  });

  if (mailErr) {
    console.error('send survey mail:', mailErr);
    return { success: false, error: 'Pa t kapab voye imèl la.', status: 502 };
  }

  await db.from('kyc_survey_sends').insert({
    user_id: userId,
    email_to: email,
    resend_id: mailData?.id || null,
  });

  return { success: true, email, resend_id: mailData?.id || null };
}
