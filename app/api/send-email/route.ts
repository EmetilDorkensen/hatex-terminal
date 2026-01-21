import { Resend } from 'resend';
import { NextResponse } from 'next/server';

// Ranplase liy sa a ak kle Resend ou a
const resend = new Resend('re_8jNiA3p6_5byjVa9V8hQzxJfeEZsXwUNA');

export async function POST(req: Request) {
  try {
    const { to, subject, non, mesaj } = await req.json();

    const data = await resend.emails.send({
      from: 'Hatex <contact@hatexcard.com>',
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: sans-serif; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
          <h1 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">HATEX CARD</h1>
          <p style="font-size: 16px;">Bonjou <strong>${non}</strong>,</p>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ddd;">
            <p style="font-size: 15px; color: #333;">${mesaj}</p>
          </div>
          <p style="font-size: 12px; color: #777;">Si ou gen kesyon, kontakte sipò nou an.</p>
        </div>
      `,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}