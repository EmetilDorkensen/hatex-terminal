import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { ensureMerchantApiCredentials } from '@/lib/security/merchant-provisioning';

export async function POST() {
  try {
    const supabaseSession = await createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data: profile, error: profileErr } = await supabaseSession
        .from('profiles')
        .select('id, kyc_status, is_card_activated, is_merchant, api_key, webhook_secret')
        .eq('id', user.id)
        .single();

      if (profileErr || !profile) {
        return NextResponse.json({ error: 'Pwofil pa jwenn.' }, { status: 404 });
      }

      const result = await ensureMerchantApiCredentials(supabaseSession, profile);
      if (!result.eligibility.eligible) {
        return NextResponse.json(
          { error: 'Kont ou poko elijib.', eligibility: result.eligibility },
          { status: 403 }
        );
      }

      return NextResponse.json({
        api_key: result.api_key,
        is_merchant: result.is_merchant,
        webhook_secret: result.webhook_secret,
        provisioned: result.provisioned,
        eligibility: result.eligibility,
      });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, kyc_status, is_card_activated, is_merchant, api_key, webhook_secret')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Pwofil pa jwenn.' }, { status: 404 });
    }

    const result = await ensureMerchantApiCredentials(supabaseAdmin, profile);

    if (!result.eligibility.eligible) {
      return NextResponse.json(
        { error: 'Kont ou poko elijib.', eligibility: result.eligibility },
        { status: 403 }
      );
    }

    return NextResponse.json({
      api_key: result.api_key,
      is_merchant: result.is_merchant,
      webhook_secret: result.webhook_secret,
      provisioned: result.provisioned,
      eligibility: result.eligibility,
    });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
