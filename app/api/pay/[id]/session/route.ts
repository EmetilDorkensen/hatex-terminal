import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';

/** Detay fakti peman (piblik) — san balans machann. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ valid: false, message: 'Fakti pa valab.' }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: request, error } = await supabase
      .from('payment_requests')
      .select('id, amount, order_id, status, merchant_id, redirect_url, webhook_url')
      .eq('id', id)
      .maybeSingle();

    if (error || !request) {
      return NextResponse.json({ valid: false, message: 'Fakti sa a pa valab oswa li pa egziste.' }, { status: 404 });
    }
    if (request.status === 'completed') {
      return NextResponse.json({ valid: false, message: 'Fakti sa a te deja peye.' }, { status: 410 });
    }

    const { data: merchant } = await supabase
      .from('profiles')
      .select('business_name, full_name')
      .eq('id', request.merchant_id)
      .single();

    return NextResponse.json({
      valid: true,
      payment: {
        id: request.id,
        amount: request.amount,
        order_id: request.order_id,
        redirect_url: request.redirect_url,
        webhook_url: request.webhook_url,
      },
      merchant_name: merchant?.business_name || merchant?.full_name || 'Machann',
    });
  } catch {
    return NextResponse.json({ valid: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
