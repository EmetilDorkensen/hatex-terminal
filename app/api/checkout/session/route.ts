import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';

/** Valide token QR epi retounen enfòmasyon piblik machann (SAN api_key). */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json({ valid: false, message: 'Token manke.' }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: tokenData, error: tokenError } = await supabase
      .from('payment_tokens')
      .select('merchant_id, expires_at')
      .eq('id', token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return NextResponse.json({ valid: false, message: 'Token pa valid.' }, { status: 404 });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, message: 'Token ekspire.' }, { status: 410 });
    }

    const { data: merchant, error: merchantError } = await supabase
      .from('profiles')
      .select('id, business_name, full_name, avatar_url, account_status')
      .eq('id', tokenData.merchant_id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ valid: false, message: 'Machann pa jwenn.' }, { status: 404 });
    }

    if (merchant.account_status === 'suspended') {
      return NextResponse.json({ valid: false, message: 'Machann sa a pa disponib.' }, { status: 403 });
    }

    return NextResponse.json({
      valid: true,
      merchant: {
        id: merchant.id,
        business_name: merchant.business_name,
        full_name: merchant.full_name,
        avatar_url: merchant.avatar_url,
      },
    });
  } catch {
    return NextResponse.json({ valid: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
