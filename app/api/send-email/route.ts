import { Resend } from 'resend';
import { NextResponse } from 'next/server';

// Ranplase liy sa a ak kle Resend ou a si w pa itilize .env
const resend = new Resend('re_8jNiA3p6_5byjVa9V8hQzxJfeEZsXwUNA');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, subject, non, mesaj } = body;

    console.log("LOG: Ap voye email bay:", to);

    const { data, error } = await resend.emails.send({
      from: 'Hatex <contact@hatexcard.com>', // Fòk li ekri konsa egzakteman
      to: [to],
      subject: subject || 'Mizajou Hatex Card',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 2px solid #dc2626; border-radius: 10px;">
          <h1 style="color: #dc2626;">HATEX CARD</h1>
          <p>Bonjou <strong>${non}</strong>,</p>
          <p style="font-size: 16px;">${mesaj}</p>
          <hr />
          <p style="font-size: 10px; color: #666;">Notifikasyon sa a otomatik. Pa reponn li.</p>
        </div>
      `,
    });

    if (error) {
      console.error("LOG: Erè Resend:", error);
      return NextResponse.json({ error }, { status: 400 });
    }

    console.log("LOG: Email pati ak siksè!");
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("LOG: Erè Server:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}