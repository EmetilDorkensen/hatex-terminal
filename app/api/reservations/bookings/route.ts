import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { computeBookingAmount, type ListingMeta } from '@/lib/reservations/types';

function publicBookingPayload(data: Record<string, any>) {
  return {
    id: data.id,
    status: data.status,
    amount: data.amount,
    scheduled_at: data.scheduled_at,
    scheduled_end: data.scheduled_end,
    quantity: data.quantity,
    nights_or_days: data.nights_or_days,
    delivery_requested: data.delivery_requested,
    delivery_address: data.delivery_address,
    customer_note: data.customer_note,
    payment_method: data.payment_method,
    paid_at: data.paid_at,
    reference_id: data.reference_id,
    receipt_snapshot: data.status === 'paid' || data.status === 'refunded' ? data.receipt_snapshot : null,
    listing: data.listing
      ? {
          id: data.listing.id,
          title: data.listing.title,
          category: data.listing.category,
          photos: data.listing.photos,
          price: data.listing.price,
          address: data.listing.address,
        }
      : null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role') || 'buyer';
  const bookingId = searchParams.get('id');
  const admin = createSupabaseAdminClient();

  // Lekti piblik pa ID (peman / resi san login) — UUID difisil pou devine
  if (bookingId) {
    const ip = getClientIp(request);
    const rl = await rateLimit(`reservation-book-get:${ip}`, 60, 300);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, message: 'Twòp demann.' }, { status: 429 });
    }

    const { data, error } = await admin
      .from('reservation_bookings')
      .select(
        '*, listing:reservation_listings(id, title, category, photos, price, address, zone, phone, meta)'
      )
      .eq('id', bookingId)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ success: false, message: 'Rezèvasyon pa jwenn.' }, { status: 404 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Machann / achtè konekte — tout detay
    if (user && (data.buyer_id === user.id || data.merchant_id === user.id)) {
      let buyer: { full_name?: string; email?: string; phone?: string } | null = null;
      if (data.buyer_id) {
        const { data: b } = await admin
          .from('profiles')
          .select('full_name, email, phone')
          .eq('id', data.buyer_id)
          .maybeSingle();
        buyer = b;
      }
      return NextResponse.json({
        success: true,
        booking: { ...data, buyer },
        bookings: [{ ...data, buyer }],
      });
    }

    // Piblik: sèlman pending/paid/refunded pou pèmèt peye + resi
    if (!['pending', 'paid', 'refunded'].includes(String(data.status))) {
      return NextResponse.json({ success: false, message: 'Rezèvasyon pa disponib.' }, { status: 403 });
    }
    const pub = publicBookingPayload(data);
    return NextResponse.json({ success: true, booking: pub, bookings: [pub] });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  let q = admin
    .from('reservation_bookings')
    .select(
      '*, listing:reservation_listings(id, title, category, photos, price, address, zone, phone, meta)'
    )
    .order('created_at', { ascending: false })
    .limit(120);

  q = role === 'merchant' ? q.eq('merchant_id', user.id) : q.eq('buyer_id', user.id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });

  const rows = data || [];
  if (role === 'merchant' && rows.length) {
    const buyerIds = [...new Set(rows.map((r) => r.buyer_id).filter(Boolean))];
    let buyers: Record<string, { full_name?: string; email?: string; phone?: string }> = {};
    if (buyerIds.length) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, email, phone')
        .in('id', buyerIds);
      for (const p of profiles || []) buyers[p.id] = p;
    }
    const enriched = rows.map((r) => ({
      ...r,
      buyer: r.buyer_id ? buyers[r.buyer_id] || null : null,
    }));
    return NextResponse.json({ success: true, bookings: enriched });
  }

  return NextResponse.json({ success: true, bookings: rows });
}

/** Create pending booking — guest OK (buyer_id null jiskaske peman kat). */
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
  // Guest otorize — pa bezwen konekte

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
  if (user && listing.merchant_id === user.id) {
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
      buyer_id: user?.id || null,
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

  return NextResponse.json({
    success: true,
    booking,
    guest: !user,
    // Guest / share: peman kat sèlman
    force_card: !user || isSubscription || body.from_share === true,
  });
}
