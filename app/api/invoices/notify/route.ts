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

    const { fetchInvoiceById } = await import('@/lib/invoices/ref');
    const rawInv = await fetchInvoiceById(
      supabase,
      invoiceId,
      ['id', 'amount', 'currency', 'client_email', 'owner_id', 'description'],
      { owner_id: user.id }
    );
    const inv = rawInv as
      | (Record<string, unknown> & {
          id: string;
          amount: number;
          currency: string | null;
          client_email: string | null;
          owner_id: string;
          description: string | null;
          share_token?: string | null;
        })
      | null;

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
    const payLink = `${site}/checkout-invoice/${inv.share_token || inv.id}`;
    const cur = inv.currency === 'USD' ? 'USD' : 'HTG';
    const amountLabel = `${Number(inv.amount).toLocaleString()} ${cur}`;

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: 'HatexCard <notifications@hatexcard.com>',
      to: [inv.client_email],
      subject: `Invoice HatexCard: ${amountLabel} — ${business}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:auto">
          <h2>${business} voye yon fakti ba ou</h2>
          <p style="font-size:28px;font-weight:bold">${amountLabel}</p>
          ${inv.description ? `<p>${inv.description}</p>` : ''}
          <p style="color:#64748b;font-size:14px">Ou ka peye avèk MonCash (Visa / Natcash talè).</p>
          <a href="${payLink}" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:bold">Peye kounye a</a>
        </div>
      `,
    });

    if (error) {
      const detail =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : '';
      console.error(
        `[invoice/notify] Resend echwe pou ${inv.client_email} (fakti ${invoiceId}):`,
        detail || error
      );
      return NextResponse.json(
        {
          success: false,
          message: detail
            ? `Imèl pa t ale: ${detail.slice(0, 200)}`
            : 'Imèl pa t ale.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, pay_link: payLink });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
