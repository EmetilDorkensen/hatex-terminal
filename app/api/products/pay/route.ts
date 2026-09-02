import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { startProductMonCashPayment } from '@/lib/products/pay';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hatexcard.com';

/**
 * Demare peman MonCash pou yon pwodwi (lyen piblik /p/[slug]).
 *
 * Body: { product_id, slug, customer_phone?, flow? ('auto' | 'redirect' | 'ussd') }
 * Retounen: { ok, checkout_url, checkout_mode: 'hosted' | 'ussd', payment_id, client_total }
 * - checkout_mode 'ussd'  → USSD dirèk voye sou telefòn kliyan an (Digicel API aktif).
 * - checkout_mode 'hosted' → paj MonCash la pou konplete (fallback jodi a).
 */
export async function POST(request: Request) {
  let productId: unknown;
  let ref: unknown;
  let customerPhone: unknown;
  let flow: unknown;
  try {
    const body = await request.json();
    productId = body?.product_id;
    ref = body?.ref ?? body?.slug ?? null;
    customerPhone = body?.customer_phone ?? body?.customerPhone ?? body?.phone ?? null;
    flow = body?.flow ?? body?.flow_mode ?? 'auto';
  } catch {
    return NextResponse.json({ ok: false, message: 'Kò mande pa valab.' }, { status: 400 });
  }

  if (typeof productId !== 'string' || !productId) {
    return NextResponse.json({ ok: false, message: 'ID pwodwi manke.' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rl = await rateLimit(`prd-moncash:${ip}`, 15, 300);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Twòp tantativ. Eseye pita.' },
      { status: 429 }
    );
  }

  const admin = createSupabaseAdminClient();
  // Ref opak (share_token) si disponib; sinon slug pwodwi a (legacy).
  const safeRef = typeof ref === 'string' && ref ? ref.trim().slice(0, 64) : '';
  // Fallback jodi a: paj pwodwi a (banner) si nou pa t kapab mete ajou return_url
  // apre insert la. (Wout /api/moncash/return fè menm bagay pou purpose 'product'.)
  const fallbackReturnUrl = safeRef
    ? `${SITE_URL}/p/${encodeURIComponent(safeRef)}?status=success`
    : `${SITE_URL}/p/${productId}?status=success`;

  const started = await startProductMonCashPayment(admin, productId, fallbackReturnUrl, {
    customerPhone,
    flow,
  });
  if (!started.ok) {
    return NextResponse.json(
      { ok: false, message: started.message },
      { status: started.status }
    );
  }

  // Paj siksè inifye: /success verifye DB (via payment id) anvan li montre "reyisi".
  // Param 'p' ba li yon lyen "Tounen nan boutik" — si mizajou sa a echwe, default
  // /api/moncash/return la ap mennen l sou /success tout jan (san 'p').
  const successReturnUrl = `${SITE_URL}/success?payment=${encodeURIComponent(
    started.paymentId
  )}&p=${encodeURIComponent(safeRef || productId)}`;
  try {
    const { error: updateError } = await admin
      .from('hatex_payments')
      .update({ return_url: successReturnUrl })
      .eq('id', started.paymentId);
    if (updateError) {
      console.error('[products/pay] pa t kapab mete return_url /success:', updateError.message);
    }
  } catch (err) {
    console.error('[products/pay] pa t kapab mete return_url /success:', err);
  }

  return NextResponse.json({
    ok: true,
    checkout_url: started.checkoutUrl,
    checkout_mode: started.checkoutMode,
    payment_id: started.paymentId,
    client_total: started.clientTotal,
  });
}
