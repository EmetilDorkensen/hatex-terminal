import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { checkMerchantEligibility } from '@/lib/security/merchant-provisioning';
import { maskApiKey, profileHasApiKey } from '@/lib/security/api-key';

export async function GET() {
  try {
    const supabaseSession = await createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
    }

    const clientRes = await supabaseSession
      .from('profiles')
      .select('id, kyc_status, is_card_activated, is_merchant, api_key_hash, api_key_prefix, api_key, webhook_secret, card_number')
      .eq('id', user.id)
      .single();

    const clientProfile = clientRes.data;
    let adminProfile = null;

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabaseAdmin = createSupabaseAdminClient();
        const adminRes = await supabaseAdmin
          .from('profiles')
          .select('id, kyc_status, is_card_activated, is_merchant, api_key_hash, api_key_prefix, api_key, webhook_secret, card_number')
          .eq('id', user.id)
          .single();
        adminProfile = adminRes.data;
      } catch {
        /* itilize pwofil sesyon kliyan an */
      }
    }

    const authoritative = adminProfile ?? clientProfile;

    if (!authoritative) {
      return NextResponse.json({ error: 'Pwofil pa jwenn.' }, { status: 404 });
    }

    const eligibility = checkMerchantEligibility(authoritative);

    return NextResponse.json({
      eligibility,
      profile: {
        id: authoritative.id,
        kyc_status: authoritative.kyc_status,
        is_card_activated: authoritative.is_card_activated,
        is_merchant: authoritative.is_merchant,
        has_api_key: profileHasApiKey(authoritative),
        api_key_prefix: authoritative.api_key_prefix || null,
        api_key_masked: maskApiKey(authoritative.api_key_prefix),
        has_card: !!authoritative.card_number,
      },
      source: adminProfile ? 'admin' : 'client',
    });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
