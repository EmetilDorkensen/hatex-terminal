import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { checkMerchantEligibility } from '@/lib/security/merchant-provisioning';
import { writeDebugLog } from '@/lib/security/debug-log';

export async function GET() {
  try {
    const supabaseSession = await createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
    }

    const clientRes = await supabaseSession
      .from('profiles')
      .select('id, kyc_status, is_card_activated, is_merchant, api_key, webhook_secret, card_number')
      .eq('id', user.id)
      .single();

    const clientProfile = clientRes.data;
    let adminProfile = null;
    let adminError: string | null = null;

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabaseAdmin = createSupabaseAdminClient();
        const adminRes = await supabaseAdmin
          .from('profiles')
          .select('id, kyc_status, is_card_activated, is_merchant, api_key, webhook_secret, card_number')
          .eq('id', user.id)
          .single();
        adminProfile = adminRes.data;
        adminError = adminRes.error?.message ?? null;
      } catch (err: unknown) {
        adminError = err instanceof Error ? err.message : 'admin client failed';
      }
    } else {
      adminError = 'SUPABASE_SERVICE_ROLE_KEY missing';
    }

    const authoritative = adminProfile ?? clientProfile;

    if (!authoritative) {
      writeDebugLog({
        sessionId: '138d33',
        runId: 'post-fix',
        hypothesisId: 'F',
        location: 'api/developer/eligibility:GET',
        message: 'no profile found',
        data: { userId: user.id, clientError: clientRes.error?.message ?? null, adminError },
      });
      return NextResponse.json({ error: 'Pwofil pa jwenn.' }, { status: 404 });
    }

    const eligibility = checkMerchantEligibility(authoritative);
    const clientEligibility = clientProfile ? checkMerchantEligibility(clientProfile) : null;

    writeDebugLog({
      sessionId: '138d33',
      runId: 'post-fix',
      hypothesisId: 'F',
      location: 'api/developer/eligibility:GET',
      message: 'server eligibility check',
      data: {
        userId: user.id,
        source: adminProfile ? 'admin' : 'client-only',
        clientKyc: clientProfile?.kyc_status ?? null,
        adminKyc: adminProfile?.kyc_status ?? null,
        clientCard: clientProfile?.is_card_activated ?? null,
        adminCard: adminProfile?.is_card_activated ?? null,
        clientEligible: clientEligibility?.eligible ?? null,
        adminEligible: eligibility.eligible,
        adminError,
      },
    });

    return NextResponse.json({
      eligibility,
      profile: {
        id: authoritative.id,
        kyc_status: authoritative.kyc_status,
        is_card_activated: authoritative.is_card_activated,
        is_merchant: authoritative.is_merchant,
        api_key: authoritative.api_key,
        webhook_secret: authoritative.webhook_secret,
        has_card: !!authoritative.card_number,
      },
      source: adminProfile ? 'admin' : 'client',
    });
  } catch (err: unknown) {
    writeDebugLog({
      sessionId: '138d33',
      runId: 'post-fix',
      hypothesisId: 'F',
      location: 'api/developer/eligibility:GET',
      message: 'unhandled error',
      data: { error: err instanceof Error ? err.message : 'unknown' },
    });
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
