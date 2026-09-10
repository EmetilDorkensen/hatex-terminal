import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { resolveInvoiceIdByRef, fetchInvoiceById } from '@/lib/invoices/ref';
import {
  quoteInvoiceMonCash,
  startInvoiceMonCashPayment,
} from '@/lib/invoices/moncash-pay';
import { publicSiteUrl } from '@/lib/urls/public';

export const dynamic = 'force-dynamic';

/** Ref piblik yon fakti: share_token opak si disponib, sinon paramèt la. */
async function invoicePublicRef(id: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const invoiceId = await resolveInvoiceIdByRef(admin, id);
  if (invoiceId) {
    const raw = await fetchInvoiceById(admin, invoiceId, ['id']);
    if (raw?.share_token) return String(raw.share_token);
  }
  return String(id || '').trim();
}

/** Quote + opsyon peman pou fakti (MonCash aktif; Natcash/Visa talè). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, message: 'ID manke.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const invoiceId = await resolveInvoiceIdByRef(admin, id);
  if (!invoiceId) {
    return NextResponse.json({ ok: false, message: 'Fakti pa jwenn.' }, { status: 404 });
  }

  const quoted = await quoteInvoiceMonCash(admin, invoiceId);
  if (!quoted.ok) {
    return NextResponse.json(
      { ok: false, message: quoted.message },
      { status: quoted.status }
    );
  }

  return NextResponse.json({ ok: true, quote: quoted.quote });
}

/**
 * Demare peman MonCash pou fakti a.
 *
 * Body: { customer_phone?, flow? ('auto' | 'redirect' | 'ussd') }
 * Retounen: { ok, checkout_url, checkout_mode: 'hosted' | 'ussd', payment_id, client_total }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = getClientIp(request);
  const rl = await rateLimit(`inv-moncash:${ip}`, 15, 300);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: 'Twòp tantativ. Eseye pita.' }, { status: 429 });
  }

  if (!id) {
    return NextResponse.json({ ok: false, message: 'ID manke.' }, { status: 400 });
  }

  let customerPhone: unknown = null;
  let flow: unknown = 'auto';
  try {
    const body = await request.json();
    customerPhone = body?.customer_phone ?? body?.customerPhone ?? body?.phone ?? null;
    flow = body?.flow ?? body?.flow_mode ?? 'auto';
  } catch {
    /* pa gen kò — nou kite default (ankò pou konpatibilite) */
  }

  const admin = createSupabaseAdminClient();
  const invoiceId = await resolveInvoiceIdByRef(admin, id);
  if (!invoiceId) {
    return NextResponse.json({ ok: false, message: 'Fakti pa jwenn.' }, { status: 404 });
  }

  const ref = await invoicePublicRef(id);
  const returnUrl = `${publicSiteUrl()}/checkout-invoice/success?id=${encodeURIComponent(ref)}`;
  const started = await startInvoiceMonCashPayment(admin, invoiceId, returnUrl, {
    customerPhone,
    flow,
  });

  if (!started.ok) {
    return NextResponse.json(
      { ok: false, message: started.message },
      { status: started.status }
    );
  }

  return NextResponse.json({
    ok: true,
    checkout_url: started.checkoutUrl,
    checkout_mode: started.checkoutMode,
    payment_id: started.paymentId,
    client_total: started.clientTotal,
  });
}

