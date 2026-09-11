import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { checkMerchantEligibility } from '@/lib/security/merchant-provisioning';
import { maskGatewayApiKey } from '@/lib/gateway/api-keys';
import type { GatewayMode } from '@/lib/moncash/config';

/** Lis kle gateway aktif yo (maske) — test + live separe. */
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`dev-api-keys-list:${ip}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
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

    const { data: keys } = await supabaseAdmin
      .from('hatex_api_keys')
      .select('id, mode, key_prefix, label, created_at, last_used_at')
      .eq('merchant_id', user.id)
      .eq('is_active', true)
      .order('mode', { ascending: true });

    return NextResponse.json({
      keys: (keys || []).map((k) => ({
        id: k.id,
        mode: k.mode as GatewayMode,
        key_prefix: k.key_prefix,
        key_masked: maskGatewayApiKey(k.key_prefix),
        label: k.label,
        created_at: k.created_at,
        last_used_at: k.last_used_at,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
