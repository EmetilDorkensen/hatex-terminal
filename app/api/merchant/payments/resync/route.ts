import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import {
  fetchMerchantIncomePayments,
  resyncMerchantPayments,
} from '@/lib/moncash/reconcile';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Re-konsilyasyon peman (bouton "Verifye ak MonCash") sou dashbord machann nan.
 *
 *   POST /api/merchant/payments/resync
 *   Body opsyonèl: { payment_id?: string }
 *
 *   - San `payment_id` → tcheke TOUT peman 'pending' kote machann sa a resevwa
 *     lajan (fakti / pwodwi / API machann) kont MonCash tèt li.
 *   - Avèk `payment_id` → sèlman peman sa a.
 *
 * Sekirite: se sèlman machann konekte a (sesyon) ka rele wout sa a; nou pa
 * janm fè konfyans navigatè a — konfimasyon an fèt sou MonCash, epi nou
 * re-li baz done a pou retounen verite a (DB = sèl sous konfimasyon).
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`merchant-resync:${ip}`, 15, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Twòp demann. Tanpri retounen pita.' },
      { status: 429 }
    );
  }

  const srv = await createSupabaseServerClient();
  const {
    data: { user },
  } = await srv.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  let paymentId: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.payment_id === 'string' && body.payment_id.trim()) {
      paymentId = body.payment_id.trim();
    }
  } catch {
    // body anlè — san payment_id vle di: tout peman an atant
  }

  if (paymentId && !UUID_RE.test(paymentId)) {
    return NextResponse.json(
      { ok: false, message: 'payment_id pa valab.' },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const resync = await resyncMerchantPayments(admin, user.id, paymentId);

  if (!resync.ok) {
    return NextResponse.json(
      { ok: false, message: resync.message || 'Pa t kapab verifye peman an.' },
      { status: 404 }
    );
  }

  // Re-li DB pou jwenn verite a (status yo ka fin chanje) — yo se done yo
  // ki ap afiche nan dashbord la.
  const payments = await fetchMerchantIncomePayments(admin, user.id);

  return NextResponse.json({
    ok: true,
    summary: {
      checked: resync.checked,
      paid: resync.paid,
      failed: resync.failed,
    },
    payments,
  });
}
