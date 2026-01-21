import { Resend } from 'resend';
import { NextResponse } from 'next/server';

// Pa bliye mete API Key ou a nan .env oswa ranplase l isit la
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { to, subject, non, mesaj } = await req.json();

    const data = await resend.emails.send({
      from: 'Hatex <contact@hatexcard.com>', // Fòk li ekri konsa egzakteman
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #dc2626;">HATEX CARD</h2>
          <p>Bonjou <strong>${non}</strong>,</p>
          <p>${mesaj}</p>
          <hr />
          <p style="font-size: 12px; color: #666;">Mèsi paske ou chwazi Hatex pou tranzaksyon ou yo.</p>
        </div>
      `,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Erè Resend API:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}