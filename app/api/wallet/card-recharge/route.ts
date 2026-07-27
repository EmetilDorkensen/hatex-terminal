import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { requireMoneySession } from '@/lib/security/require-money-session';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

/** Rechaj kat — MFA + montan verifye nan RPC. */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`wallet-card-recharge:${ip}`, 12, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp tantativ.' }, { status: 429 });
  }

  const auth = await requireMoneySession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Montan pa valab.' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc('process_card_recharge', {
      p_user_id: auth.user.id,
      p_amount: amount,
    });

    if (error) {
      return NextResponse.json({ success: false, message: error.message || 'Rechaj echwe.' }, { status: 400 });
    }
    if (!data?.success) {
      return NextResponse.json({ success: false, message: data?.message || 'Rechaj echwe.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...data });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
