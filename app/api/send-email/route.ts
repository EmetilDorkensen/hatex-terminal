import { Resend } from 'resend';
import { NextResponse } from 'next/server';

// METE API KEY OU A NAN PLAS 're_...' SI OU PA GEN FICHYE .ENV
const resend = new Resend('re_8jNiA3p6_5byjVa9V8hQzxJfeEZsXwUNA');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, subject, non, mesaj } = body;

    console.log("Ap eseye voye email bay:", to);

    const data = await resend.emails.send({
      from: 'Hatex <contact@hatexcard.com>',
      to: [to],
      subject: subject || 'Mizajou Hatex Card',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 2px solid #dc2626; border-radius: 15px;">
          <h1 style="color: #dc2626;">HATEX CARD</h1>
          <p>Bonjou <strong>${non}</strong>,</p>
          <p style="font-size: 16px;">${mesaj}</p>
          <hr />
          <p style="font-size: 12px; color: #666;">&copy; 2026 Hatex Card</p>
        </div>
      `,
    });

    console.log("Email pati ak siksè:", data);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Erè Resend nan API a:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}