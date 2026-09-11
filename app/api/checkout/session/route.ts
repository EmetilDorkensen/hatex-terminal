import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { checkoutUrlFor, checkoutModeOf } from '@/lib/gateway/create-payment';
import type { GatewayMode } from '@/lib/moncash/config';

export const dynamic = 'force-dynamic';

/**
 * Sesyon checkout piblik pou paj /checkout/[id].
 *
 *   GET /api/checkout/session?payment_id=<uuid>
 *
 * Se paj peman HatexCard-hosted la (menm eksperyans ak pwodwi/fakti) ki sèvi
 * ak li. Li retounen SÈLMAN done ki bon pou kliyan k ap peye a:
 * montan, deskripsyon, non biznis machann lan, estati ak lyen MonCash la.
 * Pa gen okenn kle API, frè detay, ni done prive machann.
 * ID a se yon UUID aleatwa — li pa ka devine.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = (url.searchParams.get('payment_id') || '').trim();

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(paymentId)) {
    return NextResponse.json({ ok: false, message: 'payment_id pa valab.' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rl = await rateLimit(`pay-session:${ip}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: 'Twòp demann. Eseye pita.' }, { status: 429 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('hatex_payments')
    .select(
      'id, merchant_id, mode, status, client_total, description, moncash_token, metadata, return_url, expires_at, paid_at'
    )
    .eq('id', paymentId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: 'Peman pa jwenn.' }, { status: 404 });
  }

  let status: string = data.status;
  if (status === 'pending' && data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    status = 'expired';
  }

  // Non biznis machann lan (pou kliyan an konnen ki moun l ap peye).
  let merchantName = 'Machann HatexCard';
  const { data: profile } = await admin
    .from('profiles')
    .select('business_name, full_name')
    .eq('id', data.merchant_id)
    .maybeSingle();
  if (profile) {
    merchantName = String(profile.business_name || profile.full_name || merchantName);
  }

  const row = {
    mode: (data.mode === 'test' ? 'test' : 'live') as GatewayMode,
    moncash_token: (data.moncash_token as string | null) ?? null,
  };
  const metadata = (data.metadata as Record<string, unknown> | null) ?? null;
  const checkoutMode = checkoutModeOf({ metadata });

  return NextResponse.json({
    ok: true,
    payment: {
      id: data.id,
      mode: row.mode,
      status,
      amount: Number(data.client_total),
      currency: 'HTG',
      description: (data.description as string | null) ?? null,
      merchant_name: merchantName,
      checkout_mode: checkoutMode,
      // Lyen paj MonCash la — sèlman lè peman an toujou pending.
      moncash_url: status === 'pending' ? checkoutUrlFor(row) : null,
      return_url: (data.return_url as string | null) ?? null,
      expires_at: data.expires_at,
      paid_at: data.paid_at,
    },
  });
}
