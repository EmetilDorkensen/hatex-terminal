import { Resend } from 'resend';

/**
 * Modil santral pou voye imèl notifikasyon atravè Resend.
 *
 * Tout imèl kliyan yo soti nan menm adrès la (notifications@hatexcard.com) —
 * adrès sa a se youn ki deja verifye / ap mache pou fakti yo nan Resend.
 * Api key la li nan anviwònman Vercel (RESEND_API_KEY).
 */

export const NOTIFY_FROM = 'HatexCard <notifications@hatexcard.com>';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hatexcard.com';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Eksteryè a (brand) pou tout imèl notifikasyon — menm stil ak paj yo. */
export function shellHtml(kicker: string, innerHtml: string): string {
  return `
  <div style="font-family:sans-serif; max-width:560px; margin:auto; border:1px solid #e5e7eb; border-radius:20px; overflow:hidden; background:#ffffff;">
    <div style="background:#000; padding:26px 32px;">
      <h1 style="color:#fff; margin:0; font-style:italic; letter-spacing:-1px; font-size:22px;">HATEX<span style="color:#dc2626;">CARD</span></h1>
    </div>
    <div style="padding:32px; color:#111;">
      <p style="text-transform:uppercase; font-size:11px; letter-spacing:2px; color:#6b7280; font-weight:800; margin:0 0 10px;">${escapeHtml(kicker)}</p>
      ${innerHtml}
    </div>
    <div style="padding:20px 32px; border-top:1px solid #f1f5f9; background:#fafafa;">
      <p style="color:#94a3b8; font-size:11px; line-height:1.6; margin:0;">
        HatexCard — Peman, Wallet & Machann. Si ou pa t fè operasyon sa a, kontakte
        <a href="${SITE_URL}/kontakte" style="color:#dc2626;">sipò HatexCard</a> imedyatman.
      </p>
    </div>
  </div>`;
}

export type SendMailResult = { ok: true } | { ok: false; message: string };

/**
 * Voye yon imèl atravè Resend. Pa janm jete — tout erè yo loje.
 * Retounen { ok } pou kòd ki rele a ka deside si l bezwen reyaji.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  logLabel?: string;
}): Promise<SendMailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] ${opts.logLabel || 'sendMail'}: RESEND_API_KEY pa konfigire — imèl pa voye.`);
    return { ok: false, message: 'RESEND_API_KEY pa konfigire.' };
  }

  const to = String(opts.to || '').trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.warn(`[email] ${opts.logLabel || 'sendMail'}: adrès pa valab — ${to || '(vid)'}`);
    return { ok: false, message: 'Adrès imèl pa valab.' };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: NOTIFY_FROM,
      to: [to],
      subject: String(opts.subject).slice(0, 180),
      html: opts.html,
    });

    if (error) {
      const detail =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : '';
      console.error(`[email] ${opts.logLabel || 'sendMail'} echwe pou ${to}:`, detail || error);
      return { ok: false, message: detail || 'Resend te refize imèl la.' };
    }

    return { ok: true };
  } catch (err: unknown) {
    console.error(
      `[email] ${opts.logLabel || 'sendMail'} eksepsyon pou ${to}:`,
      err instanceof Error ? err.message : err
    );
    return { ok: false, message: err instanceof Error ? err.message : 'Erè inatann.' };
  }
}

/* ============================= ALÈT SEKIRITE ============================= */

export type SecurityEventKind = 'password_changed' | 'pin_changed' | 'pin_set';

function securityCopy(kind: SecurityEventKind): { subject: string; bodyHtml: string } {
  if (kind === 'pin_changed') {
    return {
      subject: 'HatexCard — PIN ou chanje',
      bodyHtml: `
        <h2 style="margin:0 0 16px; font-size:19px;">PIN ou fèk chanje 🔐</h2>
        <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 18px;">
          N ap konfime PIN ou (kòd 4 chif ou sèvi pou peye / transfere) fèk chanje sou kont ou a.
          Si se ou menm ki fè sa, pa bezwen fè anyen.
        </p>
        <p style="color:#dc2626; font-size:13px; line-height:1.7; margin:0; font-weight:600;">
          Si se PA OU menm ki chanje PIN an, kontakte sipò HatexCard imedyatman e bloke kont ou a.
        </p>`,
    };
  }
  if (kind === 'pin_set') {
    return {
      subject: 'HatexCard — PIN aktivè',
      bodyHtml: `
        <h2 style="margin:0 0 16px; font-size:19px;">PIN ou aktivè 🔐</h2>
        <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 18px;">
          Yon PIN (kòd 4 chif pou peye / transfere) fèk anrejistre sou kont ou a.
          Si se ou menm ki fè sa, pa bezwen fè anyen.
        </p>
        <p style="color:#dc2626; font-size:13px; line-height:1.7; margin:0; font-weight:600;">
          Si se PA OU menm ki mete PIN an, kontakte sipò HatexCard imedyatman e bloke kont ou a.
        </p>`,
    };
  }
  return {
    subject: 'HatexCard — Modpas ou chanje',
    bodyHtml: `
      <h2 style="margin:0 0 16px; font-size:19px;">Modpas ou fèk chanje 🔑</h2>
      <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 18px;">
        N ap konfime modpas kont HatexCard ou a fèk chanje avèk siksè.
        Si se ou menm ki fè sa, pa bezwen fè anyen — ou ka konekte ak nouvo modpas la.
      </p>
      <p style="color:#dc2626; font-size:13px; line-height:1.7; margin:0; font-weight:600;">
        Si se PA OU menm ki chanje modpas la, kontakte sipò HatexCard imedyatman e fè yon reset sekirite.
      </p>`,
  };
}

/** Alèt sekirite lè modpas oswa PIN chanje / mete. Pa janm jete. */
export async function sendSecurityAlertEmail(
  to: string,
  kind: SecurityEventKind
): Promise<SendMailResult> {
  const copy = securityCopy(kind);
  return sendMail({
    to,
    subject: copy.subject,
    html: shellHtml('Alèt Sekirite', copy.bodyHtml),
    logLabel: `security-alert:${kind}`,
  });
}
