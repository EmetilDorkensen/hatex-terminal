import { Resend } from 'resend';
import { NextResponse } from 'next/server';

// Ranplase 're_123456789' ak API Key ou jwenn nan dashboard Resend lan
const resend = new Resend('re_8jNiA3p6_5byjVa9V8hQzxJfeEZsXwUNA');

export async function POST(req: Request) {
  try {
    const { to, subject, non, mesaj } = await req.json();

    const data = await resend.emails.send({
      from: 'Hatex <noreply@hatex.com>', // Mete email pwofesyonèl ou a la
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #dc2626; text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">HATEX NOTIFIKASYON</h2>
          <p style="font-size: 16px;">Bonjou <strong>${non}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.5; color: #333;">${mesaj}</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #888;">
            <p>Mèsi paske ou fè nou konfyans!</p>
            <p>&copy; 2024 HATEX - Tout dwa rezève.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Erè voye imèl' }, { status: 500 });
  }
}