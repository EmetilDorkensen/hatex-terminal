import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

/** Voye imèl fakti — sèlman pwopriyetè fakti a (sesyon), via Resend sèvè. */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`invoice-notify:${ip}`, 20, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp demann.' }, { status: 429 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, message: 'Sèvis imèl pa konfigire.' }, { status: 503 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const invoiceId = String(body.invoice_id || '');
    if (!invoiceId) {
      return NextResponse.json({ success: false, message: 'ID fakti manke.' }, { status: 400 });
    }

    const { data: inv } = await supabase
      .from('invoices')
      .select('id, amount, client_email, owner_id, description')
      .eq('id', invoiceId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!inv?.client_email) {
      return NextResponse.json({ success: false, message: 'Fakti pa jwenn.' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_name, full_name')
      .eq('id', user.id)
      .single();

    const business =
      profile?.business_name || profile?.full_name || 'HatexCard';
    const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://hatexcard.com';
    const payLink = `${site}/checkout-invoice/${inv.id}`;

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: 'HatexCard <notifications@hatexcard.com>',
      to: [inv.client_email],
      subject: `Invoice HatexCard: ${inv.amount} HTG — ${business}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:auto">
          <h2>${business} voye yon fakti ba ou</h2>
          <p style="font-size:28px;font-weight:bold">${Number(inv.amount).toLocaleString()} HTG</p>
          ${inv.description ? `<p>${inv.description}</p>` : ''}
          <a href="${payLink}" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:bold">Peye kounye a</a>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ success: false, message: 'Imèl pa t ale.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, pay_link: payLink });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
