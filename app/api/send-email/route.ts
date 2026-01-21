import { Resend } from 'resend';
import { NextResponse } from 'next/server';

// Nou rale API Key la nan envirònman an pou sekirite

const resend = new Resend('re_8jNiA3p6_5byjVa9V8hQzxJfeEZsXwUNA');
export async function POST(req: Request) {
  try {
    const { to, subject, non, mesaj } = await req.json();

    // Tcheke si tout enfòmasyon yo la
    if (!to || !non || !mesaj) {
      return NextResponse.json({ error: "Enfòmasyon manke" }, { status: 400 });
    }

    const data = await resend.emails.send({
      from: 'Hatex <contact@hatexcard.com>', // Adrès ou te verifye a
      to: [to],
      subject: subject || 'Mizajou Hatex Card',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px dashed #dc2626; border-radius: 15px; background-color: #f9f9f9;">
          <h1 style="color: #dc2626; text-transform: uppercase; font-size: 20px;">HATEX CARD</h1>
          <p style="font-size: 16px; color: #333;">Bonjou <strong>${non}</strong>,</p>
          <div style="background: white; padding: 15px; border-radius: 10px; margin: 15px 0;">
             <p style="font-size: 15px; line-height: 1.5; color: #555;">${mesaj}</p>
          </div>
          <p style="font-size: 12px; color: #888; margin-top: 20px;">
            Mèsi paske ou chwazi sèvis nou yo. <br>
            &copy; 2026 Hatex Card - Tout dwa rezève.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Erè Resend:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}