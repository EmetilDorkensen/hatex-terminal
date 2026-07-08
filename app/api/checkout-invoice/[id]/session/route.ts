import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';

/** Detay fakti terminal — san done sansib. */
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

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('id, amount, client_email, description, status, owner_id')
      .eq('id', id)
      .maybeSingle();

    if (error || !invoice) {
      return NextResponse.json({ valid: false, message: 'Fakti sa a pa egziste.' }, { status: 404 });
    }
    if (invoice.status === 'paid') {
      return NextResponse.json({ valid: false, message: 'Fakti sa a te deja peye.' }, { status: 410 });
    }
    if (invoice.status !== 'pending') {
      return NextResponse.json({ valid: false, message: 'Fakti sa a pa disponib.' }, { status: 410 });
    }

    const { data: merchant } = await supabase
      .from('profiles')
      .select('business_name, full_name, avatar_url, kyc_status')
      .eq('id', invoice.owner_id)
      .single();

    return NextResponse.json({
      valid: true,
      invoice: {
        id: invoice.id,
        amount: invoice.amount,
        client_email: invoice.client_email,
        description: invoice.description,
        status: invoice.status,
        owner_id: invoice.owner_id,
      },
      merchant: {
        business_name: merchant?.business_name || merchant?.full_name || 'Machann',
        full_name: merchant?.full_name,
        avatar_url: merchant?.avatar_url,
        kyc_status: merchant?.kyc_status,
      },
    });
  } catch {
    return NextResponse.json({ valid: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
