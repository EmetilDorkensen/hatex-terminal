import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { checkMerchantEligibility, ensureMerchantApiCredentials } from '@/lib/security/merchant-provisioning';
import { maskApiKey } from '@/lib/security/api-key';

/** Jenere yon nouvo kle API (ansyen an pa mache ankò). Retounen kle an klè yon sèl fwa. */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`dev-api-rotate:${ip}`, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann. Eseye ankò nan kèk minit.' }, { status: 429 });
  }

  try {
    const supabaseSession = await createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, kyc_status, is_card_activated, is_merchant, api_key, api_key_hash, api_key_prefix, webhook_secret')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Pwofil pa jwenn.' }, { status: 404 });
    }

    const eligibility = checkMerchantEligibility(profile);
    if (!eligibility.eligible) {
      return NextResponse.json({ error: 'Kont ou poko elijib.', eligibility }, { status: 403 });
    }

    const result = await ensureMerchantApiCredentials(supabaseAdmin, profile, { rotateApiKey: true });

    if (!result.api_key) {
      return NextResponse.json({ error: 'Pa kapab jenere nouvo kle a.' }, { status: 500 });
    }

    return NextResponse.json({
      api_key: result.api_key,
      api_key_prefix: result.api_key_prefix,
      api_key_masked: maskApiKey(result.api_key_prefix),
      revealed_once: true,
      message: 'Nouvo kle API jenere. Ansyen kle a pa valab ankò. Mete ajou entegrasyon ou.',
    });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
