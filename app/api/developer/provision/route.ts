import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { ensureMerchantApiCredentials } from '@/lib/security/merchant-provisioning';
import { maskApiKey } from '@/lib/security/api-key';
import { rateLimitMerchantIp } from '@/lib/security/merchant-api';

export async function POST(request: Request) {
  try {
    const ipRl = await rateLimitMerchantIp(request, 'developer-provision', 10, 300);
    if (!ipRl.allowed) {
      return NextResponse.json({ error: 'Twòp demann. Eseye ankò.' }, { status: 429 });
    }

    const supabaseSession = await createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
    }

    const loadProfile = async (client: ReturnType<typeof createSupabaseAdminClient>) =>
      client
        .from('profiles')
        .select('id, kyc_status, is_card_activated, is_merchant, api_key, api_key_hash, api_key_prefix, webhook_secret')
        .eq('id', user.id)
        .single();

    let profile;
    let supabaseWriter = createSupabaseAdminClient();

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data, error } = await loadProfile(supabaseWriter);
      if (error || !data) {
        return NextResponse.json({ error: 'Pwofil pa jwenn.' }, { status: 404 });
      }
      profile = data;
    } else {
      const { data, error } = await loadProfile(supabaseSession as unknown as ReturnType<typeof createSupabaseAdminClient>);
      if (error || !data) {
        return NextResponse.json({ error: 'Pwofil pa jwenn.' }, { status: 404 });
      }
      profile = data;
      supabaseWriter = supabaseSession as unknown as ReturnType<typeof createSupabaseAdminClient>;
    }

    const result = await ensureMerchantApiCredentials(supabaseWriter, profile);

    if (!result.eligibility.eligible) {
      return NextResponse.json(
        { error: 'Kont ou poko elijib.', eligibility: result.eligibility },
        { status: 403 }
      );
    }

    return NextResponse.json({
      api_key: result.api_key,
      api_key_prefix: result.api_key_prefix,
      api_key_masked: maskApiKey(result.api_key_prefix),
      revealed_once: !!result.api_key,
      is_merchant: result.is_merchant,
      webhook_secret: result.webhook_secret,
      provisioned: result.provisioned,
      eligibility: result.eligibility,
    });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
