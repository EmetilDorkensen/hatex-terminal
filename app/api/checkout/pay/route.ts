import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { findProfileByCard } from '@/lib/security/card-lookup';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { hashCardNumber } from '@/lib/security/hash';
import { checkApiReceiveLimit } from '@/lib/security/spending-limits';
import { normalizeInsufficientFundsMessage } from '@/lib/security/client-payment-balance';
import { resolveQrPaymentTokenId } from '@/lib/security/qr-payment-token';

const MAX_CARD_ATTEMPTS = 6;
const CARD_LOCK_WINDOW_SEC = 15 * 60;

function maskName(fullName: string | null | undefined): string {
  const parts = (fullName || '').trim().split(/\s+/);
  const first = parts[0] ? parts[0].substring(0, 3).toUpperCase() : 'KLI';
  const last = parts.length > 1 ? parts[parts.length - 1].substring(0, 3).toUpperCase() : 'YAN';
  return `${first}... ${last}...`;
}

/** Peman QR — montan soti NAN LOCK DB (pa nan body). */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`checkout-pay:${ip}`, 20, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp tantativ. Eseye pita.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const lockId = String(body.lock_id || '').trim();
    const token = resolveQrPaymentTokenId(String(body.token || '').trim());
    const cleanCard = String(body.card_number || '').replace(/\D/g, '');
    const cvv = String(body.card_cvv || '');
    const cardExpiry = String(body.card_expiry || '');
    const rawExp = cardExpiry.replace(/\D/g, '');
    const slashedExp = rawExp.length === 4 ? `${rawExp.slice(0, 2)}/${rawExp.slice(2)}` : cardExpiry;

    if (!lockId || !token) {
      return NextResponse.json(
        { success: false, message: 'Sesyon peman manke. Rekòmanse checkout la.' },
        { status: 400 }
      );
    }
    if (cleanCard.length < 13 || cleanCard.length > 19 || cvv.length < 3) {
      return NextResponse.json({ success: false, message: 'Enfòmasyon kat la pa konplè.' }, { status: 400 });
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      return NextResponse.json({ success: false, message: 'Dat ekspirasyon pa valab.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const cardHash = hashCardNumber(cleanCard);
    const cardRl = await rateLimit(`card-verify:${cardHash}`, MAX_CARD_ATTEMPTS, CARD_LOCK_WINDOW_SEC);
    if (!cardRl.allowed) {
      const mins = Math.ceil((cardRl.retryAfterSec || CARD_LOCK_WINDOW_SEC) / 60);
      return NextResponse.json(
        { success: false, message: `Twòp tantativ sou kat sa a. Eseye ankò nan ${mins} minit.` },
        { status: 429 }
      );
    }

    const { data: lock, error: lockErr } = await supabase
      .from('checkout_payment_locks')
      .select('id, token_id, merchant_id, amount, expires_at, used_at')
      .eq('id', lockId)
      .maybeSingle();

    if (lockErr || !lock) {
      return NextResponse.json({ success: false, message: 'Sesyon peman pa valid.' }, { status: 404 });
    }
    if (lock.token_id !== token) {
      return NextResponse.json({ success: false, message: 'Sesyon peman pa matche token.' }, { status: 400 });
    }
    if (lock.used_at) {
      return NextResponse.json({ success: false, message: 'Sesyon peman sa a deja itilize.' }, { status: 410 });
    }
    if (new Date(lock.expires_at) < new Date()) {
      return NextResponse.json({ success: false, message: 'Sesyon peman ekspire. Rekòmanse.' }, { status: 410 });
    }

    const amount = Number(lock.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Montan nan sesyon an pa valab.' }, { status: 400 });
    }

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
    if (tokenData.merchant_id !== lock.merchant_id) {
      return NextResponse.json({ success: false, message: 'Token / sesyon pa koresponn.' }, { status: 400 });
    }

    const { data: merchant, error: merchantError } = await supabase
      .from('profiles')
      .select('id, business_name, full_name, account_type, account_status')
      .eq('id', lock.merchant_id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ success: false, message: 'Machann pa jwenn.' }, { status: 404 });
    }
    if (merchant.account_status === 'suspended') {
      return NextResponse.json({ success: false, message: 'Machann sa a pa disponib.' }, { status: 403 });
    }

    const receiveCheck = await checkApiReceiveLimit(supabase, merchant.id, merchant.account_type, amount);
    if (!receiveCheck.allowed) {
      return NextResponse.json(
        { success: false, message: receiveCheck.message || 'Limit resepsyon depase.' },
        { status: 400 }
      );
    }

    const { profile, error: cardErr } = await findProfileByCard(supabase, cleanCard, cvv, rawExp, slashedExp);
    if (!profile) {
      return NextResponse.json({ success: false, message: cardErr || 'Kat sa a pa rekonèt.' }, { status: 401 });
    }

    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', profile.id)
      .single();

    if (!clientProfile) {
      return NextResponse.json({ success: false, message: 'Kat sa a pa rekonèt.' }, { status: 401 });
    }

    if (clientProfile.id === merchant.id) {
      return NextResponse.json({ success: false, message: 'Ou pa ka peye tèt ou.' }, { status: 400 });
    }

    // Make lock as used BEFORE payment to prevent double-spend races
    const { data: claimed, error: claimErr } = await supabase
      .from('checkout_payment_locks')
      .update({ used_at: new Date().toISOString() })
      .eq('id', lockId)
      .is('used_at', null)
      .select('id')
      .maybeSingle();

    if (claimErr || !claimed) {
      return NextResponse.json(
        { success: false, message: 'Sesyon peman deja itilize oswa ekspire.' },
        { status: 409 }
      );
    }

    const orderId = `QR-${token.slice(0, 8)}`;
    const merchantName = merchant.business_name || merchant.full_name || 'Machann';

    const { data: result, error: rpcErr } = await supabase.rpc('process_direct_card_payment', {
      p_client_id: clientProfile.id,
      p_merchant_id: merchant.id,
      p_amount: amount,
      p_order_id: orderId,
      p_client_name: maskName(clientProfile.full_name),
      p_merchant_name: merchantName,
      p_daily_received_so_far: receiveCheck.todayReceived,
    });

    if (rpcErr) {
      return NextResponse.json({ success: false, message: 'Peman an pa t reyisi.' }, { status: 400 });
    }

    const res = result as { success?: boolean; message?: string; transaction_id?: string; reference?: string } | null;
    if (!res?.success) {
      return NextResponse.json(
        { success: false, message: normalizeInsufficientFundsMessage(res?.message || 'Peman an echwe.') },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: res.message || 'Peman an reyisi!',
      transaction_id: res.transaction_id,
      reference: res.reference || null,
      amount,
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
