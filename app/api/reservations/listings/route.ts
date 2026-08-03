import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { canAccessTerminal } from '@/lib/security/merchant-provisioning';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import {
  RESERVATION_CATEGORIES,
  type ReservationCategory,
  type ListingMeta,
  validateListingInput,
} from '@/lib/reservations/types';
import { decryptMerchantShareToken } from '@/lib/reservations/share-token';
import { deleteReservationMediaFiles } from '@/lib/reservations/media';

function publicMerchantPayload(m: {
  business_name?: string | null;
  logo_url?: string | null;
  zone?: string | null;
  whatsapp?: string | null;
} | null) {
  if (!m) return null;
  return {
    business_name: m.business_name || null,
    logo_url: m.logo_url || null,
    zone: m.zone || null,
    whatsapp: m.whatsapp || null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get('mine') === '1';
  const category = searchParams.get('category');
  const zone = searchParams.get('zone');
  // Pa aksepte merchant_id nan URL piblik — sèlman token kriple
  const token = searchParams.get('token');

  const admin = createSupabaseAdminClient();

  if (mine) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
    }
    const { data, error } = await admin
      .from('reservation_listings')
      .select('*')
      .eq('merchant_id', user.id)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });

    const listings = data || [];
    const withStats = await Promise.all(
      listings.map(async (l) => {
        const [{ count: paidBuyers }, { count: activeSubs }] = await Promise.all([
          admin
            .from('reservation_bookings')
            .select('id', { count: 'exact', head: true })
            .eq('listing_id', l.id)
            .eq('status', 'paid'),
          admin
            .from('reservation_subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('listing_id', l.id)
            .in('status', ['active', 'past_due']),
        ]);
        return {
          ...l,
          paid_count: paidBuyers || 0,
          active_subscribers: activeSubs || 0,
          can_delete: (paidBuyers || 0) === 0 && (activeSubs || 0) === 0,
          can_edit: (activeSubs || 0) === 0,
        };
      })
    );

    return NextResponse.json({ success: true, listings: withStats });
  }

  let resolvedMerchant: string | null = null;
  let merchantRow: {
    business_name?: string | null;
    logo_url?: string | null;
    zone?: string | null;
    whatsapp?: string | null;
  } | null = null;

  if (token) {
    const decryptedId = decryptMerchantShareToken(token);
    if (decryptedId) {
      const { data: m } = await admin
        .from('reservation_merchants')
        .select('user_id, business_name, logo_url, zone, whatsapp')
        .eq('user_id', decryptedId)
        .maybeSingle();
      if (!m) {
        return NextResponse.json({ success: false, message: 'Lyèn pa valab.' }, { status: 404 });
      }
      resolvedMerchant = m.user_id;
      merchantRow = m;
    } else {
      // Legacy hex share_token (ansyen lyen)
      const { data: m } = await admin
        .from('reservation_merchants')
        .select('user_id, business_name, logo_url, zone, whatsapp')
        .eq('share_token', token)
        .maybeSingle();
      if (!m) {
        return NextResponse.json({ success: false, message: 'Lyèn pa valab.' }, { status: 404 });
      }
      resolvedMerchant = m.user_id;
      merchantRow = m;
    }
  }

  let q = admin
    .from('reservation_listings')
    .select(
      'id, category, title, description, price, zone, address, phone, photos, meta, is_active, created_at, merchant_id'
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(100);

  if (category && RESERVATION_CATEGORIES.includes(category as ReservationCategory)) {
    q = q.eq('category', category);
  }
  if (zone) q = q.ilike('zone', zone);
  if (resolvedMerchant) q = q.eq('merchant_id', resolvedMerchant);

  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });

  const merchantIds = [...new Set((data || []).map((l) => l.merchant_id))];
  const merchants: Record<string, ReturnType<typeof publicMerchantPayload>> = {};
  if (merchantRow && resolvedMerchant) {
    merchants[String(resolvedMerchant)] = publicMerchantPayload(merchantRow);
  }
  if (merchantIds.length) {
    const { data: ms } = await admin
      .from('reservation_merchants')
      .select('user_id, business_name, logo_url, zone, whatsapp')
      .in('user_id', merchantIds);
    for (const m of ms || []) merchants[m.user_id] = publicMerchantPayload(m);
  }

  return NextResponse.json({
    success: true,
    merchant: publicMerchantPayload(merchantRow),
    // Pa ekspoze merchant_id (UUID) nan repons piblik
    listings: (data || []).map((l) => {
      const { merchant_id: mid, ...rest } = l;
      return { ...rest, merchant: merchants[mid] || null };
    }),
  });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`reservation-listings:${ip}`, 30, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp tantativ.' }, { status: 429 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, kyc_status, is_card_activated, features_unlock_paid')
    .eq('id', user.id)
    .maybeSingle();

  if (!canAccessTerminal(profile)) {
    return NextResponse.json(
      { success: false, message: 'Ou bezwen KYC + opsyon debloke pou kreye ofri.' },
      { status: 403 }
    );
  }

  const { data: merchant } = await admin
    .from('reservation_merchants')
    .select('whatsapp')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!merchant?.whatsapp) {
    return NextResponse.json(
      { success: false, message: 'Konplete pwofil WhatsApp nan Rezèvasyon anvan.' },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const category = String(body.category || '') as ReservationCategory;
  if (!RESERVATION_CATEGORIES.includes(category)) {
    return NextResponse.json({ success: false, message: 'Kategori pa valab.' }, { status: 400 });
  }

  const photos: string[] = Array.isArray(body.photos)
    ? body.photos.map((p: unknown) => String(p)).filter(Boolean)
    : [];
  const meta = (body.meta || {}) as ListingMeta;
  const price = Number(body.price);

  const check = validateListingInput({
    category,
    title: String(body.title || ''),
    price,
    address: String(body.address || ''),
    phone: String(body.phone || ''),
    photos,
    whatsapp: merchant.whatsapp,
    meta,
  });
  if (!check.ok) {
    return NextResponse.json({ success: false, message: check.message }, { status: 400 });
  }

  if (category === 'subscription') {
    meta.billing_interval_days = Number(meta.billing_interval_days || meta.duration_days || 30);
  }

  const { data, error } = await admin
    .from('reservation_listings')
    .insert({
      merchant_id: user.id,
      category,
      title: String(body.title).trim(),
      description: body.description ? String(body.description).trim() : null,
      price,
      zone: body.zone ? String(body.zone).trim() : null,
      address: category === 'subscription' ? null : String(body.address || '').trim() || null,
      phone:
        category === 'subscription'
          ? merchant.whatsapp || null
          : String(body.phone || '').trim() || null,
      photos,
      meta,
      is_active: body.is_active !== false,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, listing: data });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!id) {
    return NextResponse.json({ success: false, message: 'ID manke.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from('reservation_listings')
    .select('id, merchant_id, category, title, description, price, address, phone, zone, photos, meta, is_active')
    .eq('id', id)
    .maybeSingle();

  if (!existing || existing.merchant_id !== user.id) {
    return NextResponse.json({ success: false, message: 'Ofri pa jwenn.' }, { status: 404 });
  }

  const contentEdit =
    body.title != null ||
    body.price != null ||
    body.description != null ||
    Array.isArray(body.photos) ||
    body.meta != null ||
    body.address != null ||
    body.phone != null ||
    body.zone != null;

  if (contentEdit) {
    const { count: activeSubs } = await admin
      .from('reservation_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', id)
      .in('status', ['active', 'past_due']);

    if ((activeSubs || 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Ou pa ka modifye ofri sa a: gen kliyan ki toujou aktif sou li. Tann yo anile anvan.',
        },
        { status: 409 }
      );
    }

    const { data: merchant } = await admin
      .from('reservation_merchants')
      .select('whatsapp')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!merchant?.whatsapp) {
      return NextResponse.json(
        { success: false, message: 'Konplete WhatsApp nan pwofil anvan.' },
        { status: 400 }
      );
    }

    const category = existing.category as ReservationCategory;
    const photos = Array.isArray(body.photos) ? body.photos.map(String) : existing.photos || [];
    const meta = (body.meta != null ? body.meta : existing.meta || {}) as ListingMeta;
    const price = body.price != null ? Number(body.price) : Number(existing.price);
    const title = body.title != null ? String(body.title) : String(existing.title);
    const check = validateListingInput({
      category,
      title,
      price,
      address:
        category === 'subscription'
          ? undefined
          : body.address != null
            ? String(body.address)
            : String(existing.address || ''),
      phone:
        category === 'subscription'
          ? merchant.whatsapp
          : body.phone != null
            ? String(body.phone)
            : String(existing.phone || ''),
      photos,
      whatsapp: merchant.whatsapp,
      meta,
    });
    if (!check.ok) {
      return NextResponse.json({ success: false, message: check.message }, { status: 400 });
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
  if (body.title != null) patch.title = String(body.title).trim();
  if (body.price != null) patch.price = Number(body.price);
  if (body.description != null) patch.description = String(body.description);
  if (Array.isArray(body.photos)) patch.photos = body.photos;
  if (body.meta != null) patch.meta = body.meta;
  if (body.address != null) patch.address = String(body.address).trim() || null;
  if (body.phone != null) patch.phone = String(body.phone).trim() || null;
  if (body.zone != null) patch.zone = String(body.zone).trim() || null;

  const { data, error } = await admin
    .from('reservation_listings')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  // Efase foto ki soti nan ofri a nan storage
  if (Array.isArray(body.photos)) {
    const next = new Set((body.photos as unknown[]).map(String));
    const removed = (existing.photos || []).filter((u: string) => !next.has(u));
    await deleteReservationMediaFiles(admin, removed);
  }

  return NextResponse.json({ success: true, listing: data });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!id) {
    return NextResponse.json({ success: false, message: 'ID manke.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from('reservation_listings')
    .select('id, merchant_id, photos')
    .eq('id', id)
    .maybeSingle();

  if (!existing || existing.merchant_id !== user.id) {
    return NextResponse.json({ success: false, message: 'Ofri pa jwenn.' }, { status: 404 });
  }

  const now = new Date().toISOString();

  // Anile abònman aktif (sèvis ap disparèt)
  await admin
    .from('reservation_subscriptions')
    .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
    .eq('listing_id', id)
    .in('status', ['active', 'past_due']);

  // Anile rezèvasyon ki poko peye
  await admin
    .from('reservation_bookings')
    .update({ status: 'cancelled', updated_at: now })
    .eq('listing_id', id)
    .eq('status', 'pending');

  // Efase foto nan storage anvan listing la
  await deleteReservationMediaFiles(admin, existing.photos || []);

  const { error } = await admin.from('reservation_listings').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, message: 'Ofri efase. Foto yo efase tou.' });
}
