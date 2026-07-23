/** Konstan + kesyon — san Node crypto (ok pou client components). */

export const KYC_SURVEY_WHATSAPP = '50937201241';
export const KYC_SURVEY_WHATSAPP_URL = `https://wa.me/${KYC_SURVEY_WHATSAPP}`;
export const KYC_SURVEY_FROM = 'HatexCard <notifications@hatexcard.com>';

export const KYC_SURVEY_QUESTIONS = [
  {
    id: 'knows_kyc',
    label: 'Èske ou konnen KYC (verifikasyon ID) obligatwa pou itilize kat, terminal, fakti ak retrè?',
    type: 'single' as const,
    options: [
      { value: 'wi', label: 'Wi, mwen konnen' },
      { value: 'non', label: 'Non, mwen pa t konnen' },
      { value: 'yon_ti_krapo', label: 'Mwen tande pale de li, men mwen pa konprann byen' },
    ],
  },
  {
    id: 'blocker',
    label: 'Ki bagay ki bloke w jodi a pou ou pa pase KYC?',
    type: 'multi' as const,
    options: [
      { value: 'fe_525', label: 'Frè 525 HTG (mwen pa gen ase sou wallet)' },
      { value: 'dokiman', label: 'Mwen pa gen dokiman ID / selfie klè' },
      { value: 'pa_konprann', label: 'Mwen pa konprann etap yo' },
      { value: 'konfyans', label: 'Mwen gen dout / pa konfye ankò' },
      { value: 'tan', label: 'Mwen pa gen tan kounye a' },
      { value: 'teknik', label: 'Pwoblèm teknik (app / foto / paj)' },
      { value: 'lot', label: 'Lòt rezon' },
    ],
  },
  {
    id: 'tried_deposit',
    label: 'Èske ou te eseye fè yon depo oswa konekte deja?',
    type: 'single' as const,
    options: [
      { value: 'wi_depo', label: 'Wi, mwen te fè depo' },
      { value: 'wi_konekte', label: 'Wi, mwen konekte men mwen pa fè depo' },
      { value: 'non', label: 'Non, mwen jis enskri' },
    ],
  },
  {
    id: 'would_help',
    label: 'Ki sa ki ta ede w pase KYC pi vit?',
    type: 'multi' as const,
    options: [
      { value: 'gid_videyo', label: 'Yon gid / videyo etap pa etap' },
      { value: 'ede_watsap', label: 'Yon moun ede m sou WhatsApp' },
      { value: 'rediksyon_fe', label: 'Rediksyon oswa tan pou peye frè a' },
      { value: 'raple', label: 'Yon rapèl lè mwen pare' },
      { value: 'lot_ede', label: 'Lòt bagay' },
    ],
  },
] as const;

export type KycSurveyAnswers = Record<string, string | string[]>;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function labelAnswers(answers: KycSurveyAnswers): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = [];
  for (const q of KYC_SURVEY_QUESTIONS) {
    const raw = answers[q.id];
    if (raw == null) continue;
    const values = Array.isArray(raw) ? raw : [raw];
    const labels = values.map((v) => q.options.find((o) => o.value === v)?.label || String(v));
    out.push({ question: q.label, answer: labels.join(', ') });
  }
  return out;
}

export function buildKycSurveyEmailHtml(opts: {
  fullName: string;
  feedbackUrl: string;
  appOrigin: string;
}): string {
  const name = escapeHtml(opts.fullName || 'Kliyan');
  const feedbackUrl = escapeHtml(opts.feedbackUrl);
  const kycUrl = escapeHtml(`${opts.appOrigin}/kyc`);
  const wa = escapeHtml(KYC_SURVEY_WHATSAPP_URL);

  return `<!DOCTYPE html>
<html lang="ht">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#4f46e5;padding:20px 24px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.02em;">HatexCard</p>
          <p style="margin:6px 0 0;color:#c7d2fe;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Kesyonman KYC</p>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <p style="margin:0 0 12px;font-size:16px;font-weight:700;">Bonjou ${name},</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">
            Ou enskri sou HatexCard, men ou <strong>poko pase verifikasyon KYC</strong> ankò.
            Nou vle konprann sa k ap bloke w pou nou ka ede w kòmanse itilize kat, terminal, fakti ak retrè.
          </p>
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#334155;">Nou ta renmen konnen:</p>
          <ul style="margin:0 0 20px;padding-left:18px;color:#475569;font-size:13px;line-height:1.7;">
            <li>Èske ou konnen KYC obligatwa pou sèvis yo?</li>
            <li>Ki bagay ki bloke w (frè, dokiman, tan, konfyans, teknik…)?</li>
            <li>Èske ou te eseye depo oswa konekte deja?</li>
            <li>Ki sa ki ta ede w pase KYC pi vit?</li>
          </ul>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
            <tr><td style="background:#4f46e5;border-radius:10px;">
              <a href="${feedbackUrl}" style="display:inline-block;padding:14px 22px;color:#fff;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Reponn kesyonman an</a>
            </td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
            <tr><td style="background:#16a34a;border-radius:10px;">
              <a href="${wa}" style="display:inline-block;padding:14px 22px;color:#fff;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Kontakte Sipò WhatsApp</a>
            </td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#64748b;line-height:1.5;">
            Ou ka tou ale dirèkteman nan KYC:
            <a href="${kycUrl}" style="color:#4f46e5;font-weight:600;">hatexcard.com/kyc</a><br/>
            WhatsApp: <strong>+509 3720 1241</strong>
          </p>
        </td></tr>
        <tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">Mesaj otomatik HatexCard — chak 24 èdtan jiskaske ou pase KYC.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
