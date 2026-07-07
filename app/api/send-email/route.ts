import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`send-email:${ip}`, 20, 300);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const admin = await requireAdminUser();
  if (!admin || !(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY pa konfigire.');
    return NextResponse.json({ error: 'Sèvis imèl pa konfigire.' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    const non = typeof body.non === 'string' ? body.non : '';
    const mesaj = typeof body.mesaj === 'string' ? body.mesaj : '';
    const subject = typeof body.subject === 'string' ? body.subject : 'HATEX CARD - MIZAJOU';

    if (!to) {
      return NextResponse.json({ error: 'Imèl destinatè manke.' }, { status: 400 });
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: 'Hatex <contact@hatexcard.com>',
      to: [to],
      subject,
      html: `<strong>Bonjou ${escapeHtml(non)},</strong><p>${escapeHtml(mesaj).replace(/\n/g, '<br/>')}</p>`,
    });

    if (error) {
      console.error('Erè Resend:', error);
      return NextResponse.json({ error: 'Pa t kapab voye imèl la.' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Erè send-email:', err?.message);
    return NextResponse.json({ error: 'Sèvè a rankontre yon erè.' }, { status: 500 });
  }
}
