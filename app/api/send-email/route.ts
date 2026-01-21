import { Resend } from 'resend';
import { NextResponse } from 'next/server';

// Sèvi ak kle API ou a
const resend = new Resend('re_8jNiA3p6_5byjVa9V8hQzxJfeEZsXwUNA');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, non, mesaj, subject } = body;

    // Resend bezwen yon objè byen fòme
    const { data, error } = await resend.emails.send({
      from: 'Hatex <contact@hatexcard.com>',
      to: [to.trim()],
      subject: subject || 'HATEX CARD - MIZAJOU',
      html: `<strong>Bonjou ${non},</strong><p>${mesaj}</p>`,
    });

    if (error) {
      console.error("Erè Resend:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Erè Server:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}