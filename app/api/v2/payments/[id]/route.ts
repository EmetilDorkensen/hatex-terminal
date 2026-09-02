import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit } from '@/lib/security/rate-limit';
import { authenticateGatewayRequest } from '@/lib/gateway/auth';
import {
  checkoutUrlFor,
  toPaymentResource,
  PAYMENT_SELECT,
  type PaymentRow,
} from '@/lib/gateway/create-payment';

/**
 * GET /v2/payments/{id}
 *
 * `id` ka se ID peman an, referans pasrèl la, oswa `order_id` machann nan.
 * Machann nan wè SÈLMAN pwòp peman li nan pwòp mòd kle a.
 */

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = createSupabaseAdminClient();

  const auth = await authenticateGatewayRequest(admin, request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.code, message: auth.message } },
      { status: auth.status }
    );
  }

  const check = await rateLimit(`v2get:key:${auth.apiKeyId}`, 240, 60);
  if (!check.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Twòp demann. Tanpri ralanti.' } },
      { status: 429, headers: { 'Retry-After': String(check.retryAfterSec ?? 60) } }
    );
  }

  const { id } = await context.params;
  const identifier = (id || '').trim();

  if (!identifier) {
    return NextResponse.json(
      { error: { code: 'missing_id', message: 'Referans peman an manke.' } },
      { status: 400 }
    );
  }

  // Toujou limite ak machann nan + mòd kle a: yon kle tès pa ka li done live
  const base = () =>
    admin
      .from('hatex_payments')
      .select(PAYMENT_SELECT)
      .eq('merchant_id', auth.merchantId)
      .eq('mode', auth.mode);

  let row: PaymentRow | null = null;

  if (UUID_RE.test(identifier)) {
    const { data } = await base().eq('id', identifier).maybeSingle();
    row = data as PaymentRow | null;
  }

  if (!row) {
    const { data } = await base().eq('gateway_order_id', identifier).maybeSingle();
    row = data as PaymentRow | null;
  }

  if (!row) {
    const { data } = await base().eq('merchant_order_id', identifier).maybeSingle();
    row = data as PaymentRow | null;
  }

  if (!row) {
    return NextResponse.json(
      { error: { code: 'payment_not_found', message: 'Peman sa a pa jwenn.' } },
      { status: 404 }
    );
  }

  const checkout = row.status === 'pending' ? checkoutUrlFor(row) : null;

  return NextResponse.json({ payment: toPaymentResource(row, checkout) });
}
