import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import {
  describeMissingDocuments,
  evaluateReadiness,
  getOpenApplication,
  markApplicationSubmitted,
} from '@/lib/kyc-v2/application';
import { profileSyncFromKycApp } from '@/lib/kyc-v2/staff-view';
import { ensureKycMoncashPayoutAccounts } from '@/lib/kyc-v2/ensure-moncash-payout';

export const dynamic = 'force-dynamic';

/**
 * Soumèt dosye KYC san frè — abonnman ranplase peman KYC.
 */
export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthenticated', message: 'Konekte anvan.' } },
      { status: 401 }
    );
  }

  const rl = await rateLimit(`kycv2:submit:${user.id}:${getClientIp(request)}`, 10, 600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Twòp eseye. Tann yon ti moman.' } },
      { status: 429 }
    );
  }

  const admin = createSupabaseAdminClient();
  const app = await getOpenApplication(admin, user.id);
  if (!app) {
    return NextResponse.json(
      { error: { code: 'no_application', message: 'Kòmanse dosye KYC ou anvan.' } },
      { status: 409 }
    );
  }

  if (app.status !== 'draft') {
    return NextResponse.json({
      ok: true,
      already: true,
      status: app.status,
    });
  }

  const readiness = await evaluateReadiness(admin, app);
  if (!readiness.ready) {
    const missing = [
      ...Object.values(readiness.missingFields),
      readiness.missingDocuments.length
        ? `Dokiman: ${describeMissingDocuments(readiness.missingDocuments)}`
        : '',
      readiness.livenessDone ? '' : 'Verifikasyon figi a poko fèt',
    ]
      .filter(Boolean)
      .join('; ');
    return NextResponse.json(
      { error: { code: 'incomplete', message: `Dosye a poko konplè. ${missing}` } },
      { status: 400 }
    );
  }

  const result = await markApplicationSubmitted(admin, app.id, null, 0);
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: 'submit_failed', message: result.message || 'Pa t kapab soumèt.' } },
      { status: 500 }
    );
  }

  // Sync tout enfo KYC nan profiles (idantite + pyès) pou Admin/Dosye/Asistans
  const { data: freshApp } = await admin
    .from('hatex_kyc_applications')
    .select(
      'full_name, phone_primary, account_type, business_name, id_document_type, id_number_hash, id_front_path, id_back_path, selfie_path, face_match_score, submitted_at, payout_phone, party1_moncash, party2_moncash'
    )
    .eq('id', app.id)
    .maybeSingle();

  await admin
    .from('profiles')
    .update(
      profileSyncFromKycApp({
        ...(freshApp || app),
        submitted_at: freshApp?.submitted_at || new Date().toISOString(),
      })
    )
    .eq('id', user.id)
    .neq('kyc_status', 'approved');

  const { data: profile } = await admin
    .from('profiles')
    .select('intended_plan, plan_status')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.intended_plan && profile.plan_status === 'pending_kyc') {
    await admin
      .from('profiles')
      .update({ plan_status: 'pending_payment' })
      .eq('id', user.id);
  }

  // Anrejistre nimewo MonCash KYC kòm premye nimewo payout (kliyan ka siprime l pita)
  await ensureKycMoncashPayoutAccounts(admin, user.id, freshApp || app);

  return NextResponse.json({
    ok: true,
    status: 'submitted',
    next: '/kyc/v2',
    intended_plan: profile?.intended_plan || null,
  });
}
