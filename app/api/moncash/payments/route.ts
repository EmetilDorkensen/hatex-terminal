import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { authenticateMerchantApiKey } from '@/lib/security/api-key';
import { startMerchantMonCashPayment } from '@/lib/moncash/merchant-pay';

export const dynamic = 'force-dynamic';

/**
 * API piblik MonCash (itilize pa plugin WooCommerce ak entegrasyon machann yo).
 *
 *   POST /api/moncash/payments
 *   Authorization: Bearer <kle API machann>
 *   Body: { amount, order_id, description?, return_url?, customer_phone?, flow?, metadata? }
 *     flow: 'auto' (default) | 'redirect' | 'ussd'
 *
 * Retounen: { ok: true, checkout_url, checkout_mode: 'hosted' | 'ussd',
 *             payment_id, client_total, reference }
 *   - checkout_mode 'ussd'   → USSD dirèk voye sou nimewo a (Digicel API aktif).
 *   - checkout_mode 'hosted' → paj MonCash (checkout_url) — fallback default.
 * Machann nan resevwa (montan - frè) sou kont li apre konfimasyon MonCash.
 */

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const ipRl = await rateLimit(`moncash-pay-get:${ip}`, 120, 60);
  if (!ipRl.allowed) {
    return jsonError(429, 'Twòp demann. Eseye ankò.');
  }

  const auth = request.headers.get('authorization') || '';
  const apiKey = /^Bearer\s+(.+)$/i.exec(auth.trim())?.[1]?.trim() || '';
  if (!apiKey) {
    return jsonError(401, 'Aksè refize. Kle API (Bearer Token) manke.');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const merchant = await authenticateMerchantApiKey(supabase, apiKey);
  if (!merchant || !merchant.is_merchant) {
    return jsonError(403, 'Kle API sa a pa valab oswa kont lan pa otorize pou resevwa peman.');
  }

  const url = new URL(request.url);
  const identifier = (url.searchParams.get('id') || url.searchParams.get('reference') || '').trim();
  if (!identifier) {
    return jsonError(400, 'Referans peman an manke (?id=...).');
  }

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let query = supabase
    .from('hatex_payments')
    .select('id, merchant_order_id, gateway_order_id, client_total, status, return_url, paid_at, created_at')
    .eq('merchant_id', merchant.id);

  const { data: row } = uuidRe.test(identifier)
    ? await query.eq('id', identifier).maybeSingle()
    : await query.eq('merchant_order_id', identifier).maybeSingle();

  if (!row) {
    return jsonError(404, 'Peman sa a pa jwenn.');
  }

  return NextResponse.json({
    payment: {
      id: row.id,
      order_id: row.merchant_order_id,
      reference: row.gateway_order_id,
      status: row.status,
      client_total: Number(row.client_total),
      return_url: row.return_url,
      paid_at: row.paid_at,
      created_at: row.created_at,
    },
  });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipRl = await rateLimit(`moncash-pay:${ip}`, 60, 60);
  if (!ipRl.allowed) {
    return jsonError(429, 'Twòp demann. Eseye ankò.');
  }

  const auth = request.headers.get('authorization') || '';
  const apiKey = /^Bearer\s+(.+)$/i.exec(auth.trim())?.[1]?.trim() || '';
  if (!apiKey) {
    return jsonError(401, 'Aksè refize. Kle API (Bearer Token) manke.');
  }

  const keyRl = await rateLimit(`moncash-pay-key:${apiKey}`, 120, 60);
  if (!keyRl.allowed) {
    return jsonError(429, 'Twòp demann pou kle API sa a. Eseye ankò.');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const merchant = await authenticateMerchantApiKey(supabase, apiKey);
  if (!merchant || !merchant.is_merchant) {
    return jsonError(403, 'Kle API sa a pa valab oswa kont lan pa otorize pou resevwa peman.');
  }
  if (merchant.account_status !== 'active') {
    return jsonError(403, 'Kont machann sa a pa aktif. Tranzaksyon an anile.');
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, 'Kò demann lan dwe se JSON valab.');
  }

  const orderId = String(body.order_id ?? body.orderId ?? '').trim();
  if (!orderId) {
    return jsonError(400, 'Chan `order_id` obligatwa (referans kòmand ou).');
  }

  const result = await startMerchantMonCashPayment(supabase, {
    merchantId: merchant.id,
    amount: Number(body.amount),
    orderId,
    description: body.description != null ? String(body.description) : null,
    returnUrl: body.return_url != null ? String(body.return_url) : null,
    customerPhone: body.customer_phone != null ? String(body.customer_phone) : null,
    flow: body.flow ?? body.flow_mode ?? 'auto',
    metadata: typeof body.metadata === 'object' && body.metadata !== null ? (body.metadata as Record<string, unknown>) : null,
  });

  if (!result.ok) {
    return jsonError(result.status, result.message);
  }

  return NextResponse.json({
    ok: true,
    checkout_url: result.checkoutUrl,
    checkout_mode: result.checkoutMode,
    payment_id: result.paymentId,
    client_total: result.clientTotal,
    reference: result.reference,
  });
}
