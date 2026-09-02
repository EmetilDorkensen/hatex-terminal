import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Estati yon peman (pou polling pandan checkout telefòn-premye / USSD).
 *
 *   GET /api/checkout/status?payment_id=<uuid>
 *
 * Se pou paj peman piblik yo (pwodwi / fakti / checkout machann). Li pa janm
 * ekspoze done machann — sèlman estati peman an ak dat yo. ID la se yon UUID
 * aleatwa (8 bytes+), kidonk li pa ka devine.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = (url.searchParams.get('payment_id') || '').trim();

  if (!paymentId) {
    return NextResponse.json({ ok: false, message: 'payment_id manke.' }, { status: 400 });
  }

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(paymentId)) {
    return NextResponse.json({ ok: false, message: 'payment_id pa valab.' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rl = await rateLimit(`pay-status:${ip}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: 'Twòp demann. Eseye pita.' }, { status: 429 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('hatex_payments')
    .select('id, status, paid_at, expires_at')
    .eq('id', paymentId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: 'Peman pa jwenn.' }, { status: 404 });
  }

  let status = data.status;
  if (status === 'pending' && data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    status = 'expired';
  }

  return NextResponse.json({
    ok: true,
    status,
    paid_at: data.paid_at,
    expires_at: data.expires_at,
  });
}
