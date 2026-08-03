import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { computeBookingAmount, type ListingMeta } from '@/lib/reservations/types';

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role') || 'buyer';
  const bookingId = searchParams.get('id');
  const admin = createSupabaseAdminClient();

  if (bookingId) {
    const { data, error } = await admin
      .from('reservation_bookings')
      .select('*, listing:reservation_listings(id, title, category, photos, price)')
      .eq('id', bookingId)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ success: false, message: 'Rezèvasyon pa jwenn.' }, { status: 404 });
    }
    if (data.buyer_id !== user.id && data.merchant_id !== user.id) {
      return NextResponse.json({ success: false, message: 'Aksè refize.' }, { status: 403 });
    }
    return NextResponse.json({ success: true, booking: data, bookings: [data] });
  }

  let q = admin
    .from('reservation_bookings')
    .select('*, listing:reservation_listings(id, title, category, photos, price)')
    .order('created_at', { ascending: false })
    .limit(80);

  q = role === 'merchant' ? q.eq('merchant_id', user.id) : q.eq('buyer_id', user.id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, bookings: data || [] });
}

/** Create pending booking — amount computed server-side */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`reservation-book:${ip}`, 25, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp tantativ.' }, { status: 429 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte pou rezève.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const listingId = String(body.listing_id || '');
  if (!listingId) {
    return NextResponse.json({ success: false, message: 'Ofri manke.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: listing } = await admin
    .from('reservation_listings')
    .select('*')
    .eq('id', listingId)
    .eq('is_active', true)
    .maybeSingle();

  if (!listing) {
    return NextResponse.json({ success: false, message: 'Ofri pa disponib.' }, { status: 404 });
  }
  if (listing.merchant_id === user.id) {
    return NextResponse.json({ success: false, message: 'Ou pa ka rezève pwòp ofri ou.' }, { status: 400 });
  }

  const meta = (listing.meta || {}) as ListingMeta;
  const isSubscription = listing.category === 'subscription';

  let scheduledAt: Date;
  if (isSubscription) {
    scheduledAt = new Date();
  } else {
    const parsed = body.scheduled_at ? new Date(String(body.scheduled_at)) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ success: false, message: 'Chwazi dat rezèvasyon an.' }, { status: 400 });
    }
    scheduledAt = parsed;
  }

  let nightsOrDays = Math.max(1, Number(body.nights_or_days) || 1);
  let scheduledEnd: Date | null = null;
  if (!isSubscription && body.scheduled_end) {
    scheduledEnd = new Date(String(body.scheduled_end));
    if (!Number.isNaN(scheduledEnd.getTime()) && scheduledEnd > scheduledAt) {
      const ms = scheduledEnd.getTime() - scheduledAt.getTime();
      nightsOrDays = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    }
  }

  const deliveryRequested =
    listing.category === 'restaurant_dish' &&
    meta.delivery_enabled === true &&
    body.delivery_requested === true;

  const deliveryFee = deliveryRequested ? Number(meta.delivery_fee || 0) : 0;
  if (deliveryRequested && !String(body.delivery_address || '').trim()) {
    return NextResponse.json({ success: false, message: 'Adrès livrezon obligatwa.' }, { status: 400 });
  }

  const customerNote = String(body.customer_note || '')
    .trim()
    .slice(0, 500);

  const unitPrice = Number(listing.price);
  const quantity = Math.max(1, Number(body.quantity) || 1);
  const amount = computeBookingAmount({
    unitPrice,
    nightsOrDays:
      listing.category === 'hotel_room' || listing.category === 'car_rental' ? nightsOrDays : 1,
    quantity: listing.category === 'restaurant_dish' || listing.category === 'bar' ? quantity : 1,
    deliveryFee,
    deliveryRequested,
  });

  const { data: booking, error } = await admin
    .from('reservation_bookings')
    .insert({
      listing_id: listing.id,
      merchant_id: listing.merchant_id,
      buyer_id: user.id,
      scheduled_at: scheduledAt.toISOString(),
      scheduled_end: scheduledEnd ? scheduledEnd.toISOString() : null,
      nights_or_days: nightsOrDays,
      quantity,
      unit_price: unitPrice,
      delivery_requested: deliveryRequested,
      delivery_fee: deliveryFee,
      delivery_address: deliveryRequested ? String(body.delivery_address).trim() : null,
      customer_note: customerNote || null,
      amount,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, booking });
}
