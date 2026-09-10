import type { SupabaseClient } from '@supabase/supabase-js';
import { isEmailConfigured, sendMail, SITE_URL, untrackedUrlBlock } from '@/lib/notify/email';

function buildConfirmEmailHtml(actionLink: string): string {
  return `
  <div style="font-family: sans-serif; max-width: 520px; margin: auto; border: 1px solid #e5e7eb; border-radius: 20px; overflow: hidden; background:#ffffff;">
    <div style="background:#000; padding:28px; text-align:center;">
      <h1 style="color:#fff; margin:0; font-style:italic; letter-spacing:-1px;">HATEX<span style="color:#dc2626;">CARD</span></h1>
    </div>
    <div style="padding:36px; text-align:center; color:#111;">
      <p style="text-transform:uppercase; font-size:11px; letter-spacing:2px; color:#6b7280; font-weight:800; margin:0 0 8px;">Konfimasyon Kont</p>
      <h2 style="margin:0 0 16px; font-size:20px;">Konfime enskripsyon ou</h2>
      <p style="color:#4b5563; font-size:14px; line-height:1.6; margin:0 0 8px;">
        Mèsi paske w enskri sou HatexCard. Louvri lyen anba a pou aktive kont ou.
        Lyen sa a ekspire apre kèk èdtan.
      </p>
      ${untrackedUrlBlock(actionLink, 'Konfime imèl ou — louvri lyen sa a')}
      <p style="color:#9ca3af; font-size:11px; line-height:1.6; margin:28px 0 0;">
        Si ou pa t kreye kont sa a, ou ka inyore imèl sa a.
      </p>
    </div>
  </div>`;
}

export type SendConfirmResult =
  | { ok: true }
  | { ok: false; message: string; status?: number };

/**
 * Voye imèl konfimasyon atravè Brevo (pa SMTP Supabase ki rate-limit).
 * Itilize magiclink hashed_token → /auth/confirm sou sit la.
 */
export async function sendSignupConfirmEmail(
  admin: SupabaseClient,
  emailRaw: string
): Promise<SendConfirmResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'Imèl pa valab.', status: 400 };
  }

  if (!isEmailConfigured()) {
    console.error('BREVO_API_KEY pa konfigire.');
    return { ok: false, message: 'Sèvis imèl pa konfigire.', status: 500 };
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${SITE_URL}/auth/callback` },
  });

  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.error('generateLink confirm failed:', error?.message);
    return { ok: false, message: 'Pa t kapab kreye lyen konfimasyon.', status: 400 };
  }

  const actionLink = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;

  const result = await sendMail({
    to: email,
    subject: 'HatexCard — Konfime enskripsyon ou',
    html: buildConfirmEmailHtml(actionLink),
    logLabel: 'signup-confirm',
  });

  if (!result.ok) {
    console.error('Erè Brevo (confirm):', result.message);
    return { ok: false, message: 'Pa t kapab voye imèl la. Eseye ankò.', status: 502 };
  }

  return { ok: true };
}
