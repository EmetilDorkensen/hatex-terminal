import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/security/supabase-server';

/** Buyer cancels their marketplace subscription */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body.subscription_id || '');
  if (!id) {
    return NextResponse.json({ success: false, message: 'ID abònman manke.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: sub } = await admin
    .from('reservation_subscriptions')
    .select('id, buyer_id, status')
    .eq('id', id)
    .maybeSingle();

  if (!sub || sub.buyer_id !== user.id) {
    return NextResponse.json({ success: false, message: 'Abònman pa jwenn.' }, { status: 404 });
  }
  if (sub.status === 'cancelled') {
    return NextResponse.json({ success: true, message: 'Deja anile.' });
  }

  const { error } = await admin
    .from('reservation_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: 'Abònman anile.' });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('reservation_subscriptions')
    .select('*, listing:reservation_listings(id, title, photos, category)')
    .or(`buyer_id.eq.${user.id},merchant_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, subscriptions: data || [] });
}
