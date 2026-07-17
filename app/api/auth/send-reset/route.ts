import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hatexcard.com';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildResetEmailHtml(actionLink: string): string {
  return `
  <div style="font-family: sans-serif; max-width: 520px; margin: auto; border: 1px solid #e5e7eb; border-radius: 20px; overflow: hidden; background:#ffffff;">
    <div style="background:#000; padding:28px; text-align:center;">
      <h1 style="color:#fff; margin:0; font-style:italic; letter-spacing:-1px;">HATEX<span style="color:#dc2626;">CARD</span></h1>
    </div>
    <div style="padding:36px; text-align:center; color:#111;">
      <p style="text-transform:uppercase; font-size:11px; letter-spacing:2px; color:#6b7280; font-weight:800; margin:0 0 8px;">Chanjman Modpas</p>
      <h2 style="margin:0 0 16px; font-size:20px;">Reyinisyalize modpas ou</h2>
      <p style="color:#4b5563; font-size:14px; line-height:1.6; margin:0 0 28px;">
        Nou resevwa yon demann pou chanje modpas kont HatexCard ou a. Klike sou bouton anba a pou w chwazi yon nouvo modpas. Lyen sa a ap ekspire nan 1 èdtan.
      </p>
      <a href="${actionLink}" style="display:inline-block; background:#dc2626; color:#fff; padding:16px 28px; border-radius:12px; text-decoration:none; font-weight:900; font-size:14px;">
        CHANJE MODPAS MWEN
      </a>
      <p style="color:#9ca3af; font-size:11px; line-height:1.6; margin:28px 0 0;">
        Si ou pa t mande sa, ou ka inyore imèl sa a — modpas ou p ap chanje.
      </p>
    </div>
  </div>`;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  // Limite kont abi (5 demann / 15 min pa IP)
  const rl = await rateLimit(`send-reset:${ip}`, 5, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  // Repons neutral pou pa devwale si yon imèl egziste (anti-enumerasyon)
  const genericOk = NextResponse.json({
    success: true,
    message: 'Si imèl sa a gen yon kont, n ap voye yon lyen pou chanje modpas la.',
  });

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return genericOk;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY pa konfigire.');
    return NextResponse.json({ success: false, message: 'Sèvis imèl pa konfigire.' }, { status: 500 });
  }

  try {
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${SITE_URL}/reset-password` },
    });

    // Si itilizatè a pa egziste, Supabase retounen yon erè — nou rete neutral
    if (error || !data?.properties?.action_link) {
      return genericOk;
    }

    const actionLink = data.properties.action_link;
    const resend = new Resend(apiKey);
    const { error: sendErr } = await resend.emails.send({
      from: 'Hatex <contact@hatexcard.com>',
      to: [email],
      subject: 'HatexCard — Chanje modpas ou',
      html: buildResetEmailHtml(escapeHtml(actionLink)),
    });

    if (sendErr) {
      console.error('Erè Resend (reset):', sendErr);
      return NextResponse.json(
        { success: false, message: 'Pa t kapab voye imèl la. Eseye ankò.' },
        { status: 502 }
      );
    }

    return genericOk;
  } catch (err: unknown) {
    console.error('Erè send-reset:', err instanceof Error ? err.message : err);
    // Rete neutral pou sekirite
    return genericOk;
  }
}
