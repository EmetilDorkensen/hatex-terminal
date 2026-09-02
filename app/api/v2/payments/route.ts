import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { authenticateGatewayRequest } from '@/lib/gateway/auth';
import {
  createGatewayPayment,
  checkoutUrlFor,
  toPaymentResource,
  PAYMENT_SELECT,
  type PaymentRow,
} from '@/lib/gateway/create-payment';

/**
 * API piblik pasrèl HatexCard.
 *
 *   POST /v2/payments   — kreye yon peman epi jwenn lyen checkout MonCash
 *   GET  /v2/payments   — lis peman machann nan
 *
 * POST body: { amount, order_id, description?, return_url?, customer_phone?, flow?, metadata? }
 *   flow: 'auto' (default) | 'redirect' | 'ussd'
 * Repons payment: { checkout_url, checkout_mode: 'hosted' | 'ussd', ... }
 *   - 'ussd'   → USSD dirèk voye sou nimewo kliyan an (Digicel API aktif, flow='ussd').
 *   - 'hosted' → paj MonCash pou konplete peman an (fallback default jodi a).
 *
 * Otantifikasyon: header `Authorization: Bearer hx_sk_test_...` (oswa live).
 */

export const dynamic = 'force-dynamic';

const CREATE_LIMIT = 60;
const CREATE_WINDOW_SEC = 60;
const LIST_LIMIT = 120;
const LIST_WINDOW_SEC = 60;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();

  // Limit pa IP anvan otantifikasyon: pwoteje kont fòsaj kle
  const ipCheck = await rateLimit(`v2pay:ip:${getClientIp(request)}`, 300, CREATE_WINDOW_SEC);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Twòp demann. Tanpri ralanti.' } },
      { status: 429, headers: { 'Retry-After': String(ipCheck.retryAfterSec ?? 60) } }
    );
  }

  const auth = await authenticateGatewayRequest(admin, request);
  if (!auth.ok) {
    return errorResponse(auth.status, auth.code, auth.message);
  }

  const keyCheck = await rateLimit(
    `v2pay:key:${auth.apiKeyId}`,
    CREATE_LIMIT,
    CREATE_WINDOW_SEC
  );
  if (!keyCheck.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: `Limit ${CREATE_LIMIT} peman pa minit rive. Tanpri ralanti.`,
        },
      },
      { status: 429, headers: { 'Retry-After': String(keyCheck.retryAfterSec ?? 60) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, 'invalid_json', 'Kò demann lan dwe se JSON valab.');
  }

  const result = await createGatewayPayment(admin, {
    merchantId: auth.merchantId,
    apiKeyId: auth.apiKeyId,
    mode: auth.mode,
    account: auth.account,
    input: {
      amount: body.amount,
      orderId: body.order_id ?? body.orderId,
      description: body.description,
      returnUrl: body.return_url ?? body.returnUrl,
      customerPhone: body.customer_phone ?? body.customerPhone,
      flow: body.flow ?? body.flow_mode ?? 'auto',
      metadata: body.metadata,
    },
  });

  if (!result.ok) {
    return errorResponse(result.status, result.code, result.message);
  }

  return NextResponse.json(
    { payment: result.payment },
    { status: result.idempotent ? 200 : 201 }
  );
}

export async function GET(request: Request) {
  const admin = createSupabaseAdminClient();

  const auth = await authenticateGatewayRequest(admin, request);
  if (!auth.ok) {
    return errorResponse(auth.status, auth.code, auth.message);
  }

  const listCheck = await rateLimit(`v2list:key:${auth.apiKeyId}`, LIST_LIMIT, LIST_WINDOW_SEC);
  if (!listCheck.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Twòp demann. Tanpri ralanti.' } },
      { status: 429, headers: { 'Retry-After': String(listCheck.retryAfterSec ?? 60) } }
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 100);
  const status = url.searchParams.get('status');

  let query = admin
    .from('hatex_payments')
    .select(PAYMENT_SELECT)
    .eq('merchant_id', auth.merchantId)
    .eq('mode', auth.mode)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    return errorResponse(500, 'storage_error', error.message);
  }

  const payments = ((data || []) as PaymentRow[]).map((row) => {
    // Lyen checkout la sèlman itil pandan peman an toujou an atant
    const checkout = row.status === 'pending' ? checkoutUrlFor(row) : null;
    return toPaymentResource(row, checkout);
  });

  return NextResponse.json({ payments, count: payments.length });
}
