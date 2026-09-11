import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { checkMerchantEligibility } from '@/lib/security/merchant-provisioning';
import { rotateGatewayApiKey, maskGatewayApiKey } from '@/lib/gateway/api-keys';
import type { GatewayMode } from '@/lib/moncash/config';

/**
 * Woule kle API v2 pou yon mòd (test | live) — tankou Stripe.
 * Body: { mode: 'test' | 'live' }
 * Retounen kle an klè YON SÈL FWA.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`dev-api-rotate:${ip}`, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann. Eseye ankò nan kèk minit.' }, { status: 429 });
  }

  try {
    const supabaseSession = await createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabaseSession.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
    }

    let body: { mode?: unknown } = {};
    try {
      body = (await req.json()) as { mode?: unknown };
    } catch {
      /* mode manke → erè anba */
    }

    const mode = String(body?.mode || '') as GatewayMode;
    if (mode !== 'test' && mode !== 'live') {
      return NextResponse.json(
        { error: 'Di ki kle: body { "mode": "test" } oswa { "mode": "live" }.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, kyc_status, is_merchant')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Pwofil pa jwenn.' }, { status: 404 });
    }

    const eligibility = checkMerchantEligibility(profile);
    if (!eligibility.eligible) {
      return NextResponse.json({ error: 'Kont ou poko elijib.', eligibility }, { status: 403 });
    }

    const result = await rotateGatewayApiKey(
      supabaseAdmin,
      user.id,
      mode,
      mode === 'test' ? 'Kle tès' : 'Kle live'
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.message || 'Pa kapab jenere kle a.' }, { status: 500 });
    }

    return NextResponse.json({
      mode,
      api_key: result.key.token,
      api_key_prefix: result.key.keyPrefix,
      api_key_masked: maskGatewayApiKey(result.key.keyPrefix),
      revealed_once: true,
      message:
        mode === 'test'
          ? 'Nouvo kle TEST jenere (hx_sk_test_...). Ansyen kle tès la pa valab ankò. Pa melanje ak kle LIVE.'
          : 'Nouvo kle LIVE jenere (hx_sk_live_...). Ansyen kle live la pa valab ankò. Pa melanje ak kle TEST.',
    });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
