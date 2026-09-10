/**
 * Modil santral pou voye imèl notifikasyon atravè Brevo (Sendinblue).
 *
 * Env:
 *   BREVO_API_KEY          — obligatwa (oswa SENDINBLUE_API_KEY)
 *   BREVO_SENDER_EMAIL     — opsyonèl (default noreply@hatexcard.com)
 *   BREVO_SENDER_NAME      — opsyonèl (default HatexCard)
 *
 * Verifye adrès ekspeditè a nan Brevo → Senders, Domains & Dedicated IPs.
 */

export const NOTIFY_FROM = 'HatexCard <noreply@hatexcard.com>';
export const SITE_URL = (() => {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || 'https://hatexcard.com').replace(/\/$/, '');
  // Pa mete lyen localhost nan imèl kliyan (menm si .env.local gen localhost).
  if (/localhost|127\.0\.0\.1/i.test(raw)) return 'https://hatexcard.com';
  return raw;
})();

export function getBrevoApiKey(): string | null {
  const key =
    process.env.BREVO_API_KEY?.trim() ||
    process.env.SENDINBLUE_API_KEY?.trim() ||
    '';
  return key || null;
}

export function isEmailConfigured(): boolean {
  return !!getBrevoApiKey();
}

export function parseSender(from?: string | null): { name: string; email: string } {
  const fallbackEmail =
    process.env.BREVO_SENDER_EMAIL?.trim() || 'noreply@hatexcard.com';
  const fallbackName = process.env.BREVO_SENDER_NAME?.trim() || 'HatexCard';
  const raw = String(from || NOTIFY_FROM).trim();
  const m = /^(.+?)\s*<([^>]+)>$/.exec(raw);
  if (m) {
    return {
      name: m[1].trim().replace(/^["']|["']$/g, '') || fallbackName,
      email: m[2].trim() || fallbackEmail,
    };
  }
  if (raw.includes('@')) {
    return { name: fallbackName, email: raw };
  }
  return { name: fallbackName, email: fallbackEmail };
}

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

export type SendMailResult =
  | { ok: true; id?: string | null }
  | { ok: false; message: string };

/**
 * Voye yon imèl atravè Brevo Transactional API.
 * Pa janm jete — tout erè yo loje.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  logLabel?: string;
}): Promise<SendMailResult> {
  const apiKey = getBrevoApiKey();
  if (!apiKey) {
    console.warn(
      `[email] ${opts.logLabel || 'sendMail'}: BREVO_API_KEY pa konfigire — imèl pa voye.`
    );
    return { ok: false, message: 'BREVO_API_KEY pa konfigire.' };
  }

  const to = String(opts.to || '')
    .trim()
    .toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.warn(`[email] ${opts.logLabel || 'sendMail'}: adrès pa valab — ${to || '(vid)'}`);
    return { ok: false, message: 'Adrès imèl pa valab.' };
  }

  const sender = parseSender(opts.from);

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject: String(opts.subject).slice(0, 180),
        htmlContent: opts.html,
      }),
    });

    const raw = await res.text();
    let parsed: { messageId?: string; message?: string } | null = null;
    try {
      parsed = raw ? (JSON.parse(raw) as { messageId?: string; message?: string }) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const detail =
        (parsed && (parsed.message || JSON.stringify(parsed))) ||
        raw ||
        `HTTP ${res.status}`;
      console.error(`[email] ${opts.logLabel || 'sendMail'} echwe pou ${to}:`, detail);
      return { ok: false, message: String(detail).slice(0, 300) || 'Brevo te refize imèl la.' };
    }

    return { ok: true, id: parsed?.messageId || null };
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
