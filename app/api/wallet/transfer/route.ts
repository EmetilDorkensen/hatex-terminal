import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { requireMoneySession } from '@/lib/security/require-money-session';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

/** Transfè P2P — verifye MFA + RPC nan DB (frè kalkile sou sèvè). */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`wallet-transfer:${ip}`, 15, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp tantativ.' }, { status: 429 });
  }

  const auth = await requireMoneySession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const receiverEmail = String(body.receiver_email || '').trim().toLowerCase();
    const amount = Number(body.amount);

    if (!receiverEmail || !receiverEmail.includes('@')) {
      return NextResponse.json({ success: false, message: 'Imèl destinatè pa valab.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Montan pa valab.' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    // Frè kalkile nan RPC (p_fee ignorer / override pa hatex_transfer_fee)
    const { data, error } = await admin.rpc('process_transfer_by_email', {
      p_sender_id: auth.user.id,
      p_receiver_email: receiverEmail,
      p_amount: amount,
      p_fee: 0,
    });

    if (error) {
      return NextResponse.json({ success: false, message: error.message || 'Transfè echwe.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, transfer_id: data });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
