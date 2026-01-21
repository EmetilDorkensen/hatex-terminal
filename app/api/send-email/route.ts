import { Resend } from 'resend';
import { NextResponse } from 'next/server';

// Pou tès la, ou ka mete kle a dirèkteman isit la si .env la gen pwoblèm
const resend = new Resend(process.env.RESEND_API_KEY || 're_kle_ou_la');

export async function POST(req: Request) {
  try {
    const { to, non, mesaj, subject } = await req.json();

    // 1. Tcheke si imèl la valid
    if (!to || !to.includes('@')) {
      return NextResponse.json({ error: 'Email kliyan an pa valid' }, { status: 400 });
    }

    // 2. Voye imèl la via Resend
    const data = await resend.emails.send({
      from: 'Hatex <contact@hatexcard.com>',
      to: [to],
      subject: subject || 'HATEX CARD - MIZAJOU',
      html: `
        <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #dc2626;">HATEX CARD</h2>
          <p>Bonjou <b>${non}</b>,</p>
          <p>${mesaj}</p>
          <br/>
          <p style="font-size: 12px; color: #888;">Mèsi paske ou chwazi Hatex Card.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Erè Resend:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}