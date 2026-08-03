import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { checkApiReceiveLimit } from '@/lib/security/spending-limits';
import { resolveQrPaymentTokenId } from '@/lib/security/qr-payment-token';

/**
 * Bloke montan QR nan DB anvan peman — navigatè pa ka chanje amount sou /pay.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`checkout-lock:${ip}`, 30, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp tantativ. Eseye pita.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const token = resolveQrPaymentTokenId(String(body.token || '').trim());
    const amount = Number(body.amount);

    if (!token) {
      return NextResponse.json({ success: false, message: 'Token manke.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Montan pa valab.' }, { status: 400 });
    }
    if (amount > 10_000_000) {
      return NextResponse.json({ success: false, message: 'Montan twò wo.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: tokenData, error: tokenError } = await supabase
      .from('payment_tokens')
      .select('merchant_id, expires_at')
      .eq('id', token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return NextResponse.json({ success: false, message: 'Token pa valid.' }, { status: 404 });
    }
    if (new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json({ success: false, message: 'Token ekspire.' }, { status: 410 });
    }

    const { data: merchant } = await supabase
      .from('profiles')
      .select('id, account_type, account_status')
      .eq('id', tokenData.merchant_id)
      .single();

    if (!merchant || merchant.account_status === 'suspended') {
      return NextResponse.json({ success: false, message: 'Machann pa disponib.' }, { status: 403 });
    }

    const receiveCheck = await checkApiReceiveLimit(supabase, merchant.id, merchant.account_type, amount);
    if (!receiveCheck.allowed) {
      return NextResponse.json(
        { success: false, message: receiveCheck.message || 'Limit resepsyon depase.' },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { data: lock, error: lockErr } = await supabase
      .from('checkout_payment_locks')
      .insert({
        token_id: token,
        merchant_id: merchant.id,
        amount,
        expires_at: expiresAt,
      })
      .select('id, amount, expires_at')
      .single();

    if (lockErr || !lock) {
      return NextResponse.json({ success: false, message: 'Pa t kapab bloke montan an.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lock_id: lock.id,
      amount: Number(lock.amount),
      expires_at: lock.expires_at,
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
