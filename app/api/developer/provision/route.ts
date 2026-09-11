import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { ensureMerchantApiCredentials } from '@/lib/security/merchant-provisioning';
import { ensureMerchantGatewayAccount } from '@/lib/billing/provision';
import { maskApiKey, maskPublishableKey } from '@/lib/security/api-key';
import { maskGatewayApiKey } from '@/lib/gateway/api-keys';
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
        .select('id, kyc_status, is_merchant, api_key, api_key_hash, api_key_prefix, api_key_pk, api_key_pk_hash, api_key_pk_prefix, webhook_secret')
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

    let gatewayRevealed: {
      test?: { api_key: string; api_key_prefix: string; api_key_masked: string };
      live?: { api_key: string; api_key_prefix: string; api_key_masked: string };
    } = {};

    try {
      const gw = await ensureMerchantGatewayAccount(supabaseWriter, user.id);
      if (gw.revealed.test) {
        gatewayRevealed.test = {
          api_key: gw.revealed.test.token,
          api_key_prefix: gw.revealed.test.keyPrefix,
          api_key_masked: maskGatewayApiKey(gw.revealed.test.keyPrefix),
        };
      }
      if (gw.revealed.live) {
        gatewayRevealed.live = {
          api_key: gw.revealed.live.token,
          api_key_prefix: gw.revealed.live.keyPrefix,
          api_key_masked: maskGatewayApiKey(gw.revealed.live.keyPrefix),
        };
      }
    } catch {
      /* pa bloke provision kle si tab machann echwe — merchant-pay ap eseye ankò */
    }

    const { data: gatewayKeys } = await supabaseWriter
      .from('hatex_api_keys')
      .select('mode, key_prefix')
      .eq('merchant_id', user.id)
      .eq('is_active', true);

    return NextResponse.json({
      // Ansyen kle hx_live_ (plugin/legacy) — live sèlman, pa melanje ak test
      api_key: result.api_key,
      api_key_prefix: result.api_key_prefix,
      api_key_masked: maskApiKey(result.api_key_prefix),
      api_key_pk: result.api_key_pk,
      api_key_pk_prefix: result.api_key_pk_prefix,
      api_key_pk_masked: maskPublishableKey(result.api_key_pk_prefix),
      revealed_once: !!result.api_key,
      // Kle v2 separe: hx_sk_test_ + hx_sk_live_
      gateway_keys: (gatewayKeys || []).map((k) => ({
        mode: k.mode,
        key_prefix: k.key_prefix,
        key_masked: maskGatewayApiKey(k.key_prefix),
      })),
      gateway_revealed: gatewayRevealed,
      is_merchant: result.is_merchant,
      webhook_secret: result.webhook_secret,
      provisioned: result.provisioned,
      eligibility: result.eligibility,
    });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
