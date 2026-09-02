import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Rezime yon peman pou paj siksè inifye (/success) — pwodwi / API / plugin.
 *
 *   GET /api/checkout/summary?payment_id=<uuid>
 *
 * DB se sous verite a: paj /success pa janm montre "reyisi" san endpoint sa a
 * pa retounen status === 'paid'. Nou retounen sèlman enfòmasyon ki sanble sou
 * yon resi (montan, deskripsyon, non machann) — pa janm id DB / kle machann.
 * ID la se yon UUID aleatwa, kidonk li pa ka devine.
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
  const rl = await rateLimit(`pay-summary:${ip}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: 'Twòp demann. Eseye pita.' }, { status: 429 });
  }

  try {
    const admin = createSupabaseAdminClient();

    const { data } = await admin
      .from('hatex_payments')
      .select(
        'id, status, purpose, description, client_total, merchant_order_id, merchant_id, paid_at, expires_at'
      )
      .eq('id', paymentId)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({ ok: false, message: 'Peman pa jwenn.' }, { status: 404 });
    }

    let status = data.status;
    if (status === 'pending' && data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      status = 'expired';
    }

    let merchant: { name: string } | null = null;
    if (data.merchant_id) {
      const { data: profile } = await admin
        .from('profiles')
        .select('business_name, full_name')
        .eq('id', data.merchant_id)
        .maybeSingle();
      if (profile) {
        merchant = { name: profile.business_name || profile.full_name || 'Machann' };
      }
    }

    return NextResponse.json({
      ok: true,
      status,
      paid_at: data.paid_at,
      expires_at: data.expires_at,
      payment: {
        purpose: data.purpose || 'merchant',
        description: data.description,
        client_total: data.client_total,
        merchant_order_id: data.merchant_order_id,
      },
      merchant,
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
