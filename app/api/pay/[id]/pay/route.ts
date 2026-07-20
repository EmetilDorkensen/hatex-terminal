import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { hashCardNumber } from '@/lib/security/hash';
import { normalizeInsufficientFundsMessage } from '@/lib/security/client-payment-balance';

const MAX_CARD_ATTEMPTS = 6;
const CARD_LOCK_WINDOW_SEC = 15 * 60;

/** Peman fakti /pay/[id] — kat verifye sou sèvè sèlman. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: paymentId } = await params;
  const ip = getClientIp(request);
  const rl = await rateLimit(`pay-invoice:${ip}`, 20, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp tantativ. Eseye pita.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const cleanCard = String(body.card_number || '').replace(/\D/g, '');
    const cvv = String(body.cvv || '');
    const expiry = String(body.expiry || '');

    if (cleanCard.length < 16 || cvv.length < 3 || expiry.length !== 5) {
      return NextResponse.json({ success: false, message: 'Enfòmasyon kat la pa konplè.' }, { status: 400 });
    }

    const cardHash = hashCardNumber(cleanCard);
    const cardRl = await rateLimit(`card-verify:${cardHash}`, MAX_CARD_ATTEMPTS, CARD_LOCK_WINDOW_SEC);
    if (!cardRl.allowed) {
      const mins = Math.ceil((cardRl.retryAfterSec || CARD_LOCK_WINDOW_SEC) / 60);
      return NextResponse.json(
        { success: false, message: `Twòp tantativ sou kat sa a. Eseye ankò nan ${mins} minit.` },
        { status: 429 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: paymentReq } = await supabase
      .from('payment_requests')
      .select('id, status, order_id, amount, webhook_url, redirect_url')
      .eq('id', paymentId)
      .maybeSingle();

    if (!paymentReq) {
      return NextResponse.json({ success: false, message: 'Fakti pa jwenn.' }, { status: 404 });
    }
    if (paymentReq.status === 'completed') {
      return NextResponse.json({ success: false, message: 'Fakti sa a te deja peye.' }, { status: 410 });
    }

    const { data: result, error } = await supabase.rpc('process_merchant_payment_with_card', {
      p_payment_id: paymentId,
      p_card_number: cleanCard,
      p_exp_date: expiry,
      p_cvv: cvv,
    });

    if (error) {
      return NextResponse.json({ success: false, message: 'Peman an pa t reyisi.' }, { status: 400 });
    }

    const res = result as { success?: boolean; message?: string; redirect_url?: string } | null;
    if (!res?.success) {
      return NextResponse.json(
        { success: false, message: normalizeInsufficientFundsMessage(res?.message || 'Peman an echwe.') },
        { status: 400 }
      );
    }

    // Webhook machann — sou sèvè sèlman (pa ekspoze URL nan navigatè)
    if (paymentReq.webhook_url) {
      try {
        await fetch(paymentReq.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: paymentReq.order_id,
            status: 'paid',
            transaction_id: paymentId,
            amount_htg: paymentReq.amount,
          }),
        });
      } catch {
        /* webhook echwe — peman deja konfime */
      }
    }

    return NextResponse.json({
      success: true,
      message: res.message || 'Peman an reyisi!',
      redirect_url: res.redirect_url || paymentReq.redirect_url || null,
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
