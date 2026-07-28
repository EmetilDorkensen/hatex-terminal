import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { checkMerchantEligibility } from '@/lib/security/merchant-provisioning';
import { maskApiKey, profileHasApiKey } from '@/lib/security/api-key';

type EligibilityProfile = {
  id: string;
  kyc_status?: string | null;
  is_card_activated?: boolean | null;
  is_merchant?: boolean | null;
  api_key_hash?: string | null;
  api_key_prefix?: string | null;
  api_key?: string | null;
  card_last4?: string | null;
  card_number_hash?: string | null;
  account_type?: string | null;
  enterprise_status?: string | null;
};

export async function GET() {
  try {
    const supabaseSession = await createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabaseSession.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
    }

    let authoritative: EligibilityProfile | null = null;
    let source: 'admin' | 'client' = 'client';

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabaseAdmin = createSupabaseAdminClient();
        const { data } = await supabaseAdmin
          .from('profiles')
          .select(
            'id, kyc_status, is_card_activated, is_merchant, api_key_hash, api_key_prefix, api_key, card_last4, card_number_hash, account_type, enterprise_status'
          )
          .eq('id', user.id)
          .single();
        if (data) {
          authoritative = data as EligibilityProfile;
          source = 'admin';
        }
      } catch {
        /* fallback anba */
      }
    }

    if (!authoritative) {
      const { data } = await supabaseSession
        .from('profiles')
        .select(
          'id, kyc_status, is_card_activated, is_merchant, api_key_prefix, card_last4, account_type, enterprise_status'
        )
        .eq('id', user.id)
        .single();
      authoritative = data as EligibilityProfile | null;
      source = 'client';
    }

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
        has_card: !!(authoritative.card_last4 || authoritative.card_number_hash),
        account_type: authoritative.account_type || 'individual',
        enterprise_status: authoritative.enterprise_status || 'none',
      },
      source,
    });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
