import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { isEmailConfigured, sendMail } from '@/lib/notify/email';
import { CANONICAL_SITE_URL, invoicePublicUrl } from '@/lib/urls/public';

/** Voye imèl fakti — sèlman pwopriyetè fakti a (sesyon), via Brevo sèvè. */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`invoice-notify:${ip}`, 20, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp demann.' }, { status: 429 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ success: false, message: 'Sèvis imèl pa konfigire.' }, { status: 503 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

    const business = profile?.business_name || profile?.full_name || 'HatexCard';
    const payLink = invoicePublicUrl(CANONICAL_SITE_URL, {
      id: String(inv.id),
      share_token: inv.share_token ? String(inv.share_token) : null,
    });
    const cur = inv.currency === 'USD' ? 'USD' : 'HTG';
    const amountLabel = `${Number(inv.amount).toLocaleString()} ${cur}`;

    const result = await sendMail({
      to: String(inv.client_email),
      subject: `Invoice HatexCard: ${amountLabel} — ${business}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
          <div style="background:#000;padding:20px 24px">
            <h1 style="color:#fff;margin:0;font-style:italic;font-size:20px">HATEX<span style="color:#dc2626">CARD</span></h1>
          </div>
          <div style="padding:28px">
            <h2 style="margin:0 0 12px;font-size:18px">${business} voye yon fakti ba ou</h2>
            <p style="font-size:28px;font-weight:bold;margin:0 0 12px">${amountLabel}</p>
            ${inv.description ? `<p style="color:#475569">${String(inv.description)}</p>` : ''}
            <p style="color:#64748b;font-size:14px">Ou ka peye avèk HatexCard / MonCash — san kite sit la.</p>
            <p style="margin:18px 0 8px">
              <a href="${payLink}" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:bold">Peye kounye a</a>
            </p>
            <p style="margin:16px 0 0;font-size:12px;color:#64748b;line-height:1.5">
              Si bouton an montre « connexion non privée », louvri sit la dirèkteman:<br/>
              <a href="${payLink}" style="color:#4f46e5;word-break:break-all;font-weight:600">${payLink}</a>
            </p>
            <p style="margin:10px 0 0;font-size:11px;color:#94a3b8">Kopi lyen an epi kole l nan Chrome / Safari (dwe kòmanse ak https://hatexcard.com).</p>
          </div>
        </div>
      `,
      logLabel: 'invoice-notify',
    });

    if (!result.ok) {
      console.error('invoice notify Brevo:', result.message);
      const detail = String(result.message || '').slice(0, 220);
      return NextResponse.json(
        {
          success: false,
          message: detail
            ? `Imèl pa t ale (Brevo): ${detail}`
            : 'Pa t kapab voye imèl la.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, pay_link: payLink });
  } catch (e: unknown) {
    console.error('invoice notify:', e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
