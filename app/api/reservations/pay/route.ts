import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { requireMoneySession } from '@/lib/security/require-money-session';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { findProfileByCard } from '@/lib/security/card-lookup';
import { hashCardNumber } from '@/lib/security/hash';
import { normalizeInsufficientFundsMessage } from '@/lib/security/client-payment-balance';
import { sendSubscriptionPaidEmails } from '@/lib/reservations/notify-subscription';
import { sendReservationPaidMerchantEmail } from '@/lib/reservations/notify-booking';
import type { ListingMeta } from '@/lib/reservations/types';

const MAX_CARD_ATTEMPTS = 6;
const CARD_LOCK_WINDOW_SEC = 15 * 60;

/**
 * Pay a pending reservation booking.
 * - wallet: requires logged-in money session (buyer must own booking)
 * - card: card details; buyer resolved via hash; works for share-link flow when logged in or matching card
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`reservation-pay:${ip}`, 20, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp tantativ.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const bookingId = String(body.booking_id || '');
  const method = String(body.payment_method || '') as 'wallet' | 'card';

  if (!bookingId) {
    return NextResponse.json({ success: false, message: 'Rezèvasyon manke.' }, { status: 400 });
  }
  if (method !== 'wallet' && method !== 'card') {
    return NextResponse.json({ success: false, message: 'Metòd peman pa valab.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: booking } = await admin
    .from('reservation_bookings')
    .select('*, listing:reservation_listings(id, category, title, description, meta, merchant_id)')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking || booking.status !== 'pending') {
    return NextResponse.json({ success: false, message: 'Rezèvasyon pa disponib pou peman.' }, { status: 400 });
  }

  const listing = booking.listing as {
    id?: string;
    category?: string;
    title?: string;
    description?: string | null;
    meta?: ListingMeta;
    merchant_id?: string;
  } | null;
  const listingCat = listing?.category;
  if (listingCat === 'subscription' && method !== 'card') {
    return NextResponse.json(
      { success: false, message: 'Abònman yo dwe peye ak kat HatexCard.' },
      { status: 400 }
    );
  }

  let buyerId: string | null = null;

  if (method === 'wallet') {
    const auth = await requireMoneySession();
    if (!auth.ok) return auth.response;
    if (booking.buyer_id && booking.buyer_id !== auth.user.id) {
      return NextResponse.json({ success: false, message: 'Rezèvasyon sa a pa pou ou.' }, { status: 403 });
    }
    buyerId = auth.user.id;
  } else {
    const cleanCard = String(body.card_number || '').replace(/\D/g, '');
    const cvv = String(body.cvv || '');
    const expiry = String(body.expiry || body.exp_date || '');
    if (cleanCard.length < 16 || cvv.length < 3 || expiry.length < 4) {
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

    const rawExp = expiry.replace(/\D/g, '');
    const slashedExp =
      expiry.includes('/') ? expiry : rawExp.length === 4 ? `${rawExp.slice(0, 2)}/${rawExp.slice(2)}` : expiry;

    const { profile, error: cardErr } = await findProfileByCard(
      admin,
      cleanCard,
      cvv,
      rawExp,
      slashedExp
    );
    if (cardErr || !profile) {
      return NextResponse.json(
        { success: false, message: cardErr || 'Enfòmasyon kat la pa bon.' },
        { status: 400 }
      );
    }
    buyerId = profile.id;

    // If booking already tied to another buyer, reject
    if (booking.buyer_id && booking.buyer_id !== buyerId) {
      return NextResponse.json(
        { success: false, message: 'Kat sa a pa matche ak rezèvasyon an.' },
        { status: 403 }
      );
    }
  }

  const { data: result, error } = await admin.rpc('process_reservation_payment', {
    p_booking_id: bookingId,
    p_buyer_id: buyerId,
    p_payment_method: method,
  });

  if (error) {
    return NextResponse.json({ success: false, message: error.message || 'Peman echwe.' }, { status: 400 });
  }

  const res = result as { success?: boolean; message?: string; booking_id?: string; reference_id?: string } | null;
  if (!res?.success) {
    return NextResponse.json(
      { success: false, message: normalizeInsufficientFundsMessage(res?.message || 'Peman echwe.') },
      { status: 400 }
    );
  }

  if (buyerId) {
    try {
      const [{ data: buyerProf }, { data: merchantProf }] = await Promise.all([
        admin.from('profiles').select('email, full_name').eq('id', buyerId).maybeSingle(),
        admin
          .from('profiles')
          .select('email, full_name, business_name')
          .eq('id', booking.merchant_id)
          .maybeSingle(),
      ]);
      const meta = (listing?.meta || {}) as ListingMeta;

      if (listingCat === 'subscription') {
        await sendSubscriptionPaidEmails({
          buyerEmail: buyerProf?.email,
          buyerName: buyerProf?.full_name,
          merchantEmail: merchantProf?.email,
          merchantName: merchantProf?.business_name || merchantProf?.full_name,
          planTitle: listing?.title || 'Abònman',
          amount: Number(booking.amount),
          intervalDays: Number(meta.billing_interval_days || meta.duration_days || 30),
          description: listing?.description,
        });
      }

      // Notifikasyon machann pou TOUT rezèvasyon / abònman peye
      await sendReservationPaidMerchantEmail({
        merchantEmail: merchantProf?.email,
        merchantName: merchantProf?.business_name || merchantProf?.full_name,
        buyerName: buyerProf?.full_name,
        buyerEmail: buyerProf?.email,
        listingTitle: listing?.title || 'Rezèvasyon',
        category: listingCat,
        amount: Number(booking.amount),
        scheduledAt: booking.scheduled_at,
        scheduledEnd: booking.scheduled_end,
        quantity: booking.quantity,
        deliveryRequested: booking.delivery_requested,
        deliveryAddress: booking.delivery_address,
        customerNote: booking.customer_note,
        paymentMethod: method,
        referenceId: res.reference_id || null,
      });
    } catch {
      // Pa kraze peman si imèl echwe
    }
  }

  return NextResponse.json({
    success: true,
    booking_id: res.booking_id || bookingId,
    reference_id: res.reference_id,
    transaction_id: (res as { transaction_id?: string }).transaction_id,
  });
}
