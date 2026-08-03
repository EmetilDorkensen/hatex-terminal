import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: listing, error } = await admin
    .from('reservation_listings')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !listing) {
    return NextResponse.json({ success: false, message: 'Ofri pa jwenn.' }, { status: 404 });
  }
  if (!listing.is_active) {
    return NextResponse.json({ success: false, message: 'Ofri pa aktif.' }, { status: 404 });
  }

  const { data: merchant } = await admin
    .from('reservation_merchants')
    .select('user_id, business_name, logo_url, whatsapp, phone, address, zone')
    .eq('user_id', listing.merchant_id)
    .maybeSingle();

  return NextResponse.json({ success: true, listing, merchant });
}
