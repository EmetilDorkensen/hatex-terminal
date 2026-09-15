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
      'full_name, phone_primary, account_type, business_name, id_document_type, id_number_hash, id_front_path, id_back_path, selfie_path, face_match_score, submitted_at'
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

  const phones: { phone: string; label: string; isDefault: boolean }[] = [];
  const p1 = String(app.party1_moncash || app.payout_phone || '').replace(/\D/g, '');
  const p2 = String(app.party2_moncash || '').replace(/\D/g, '');
  if (p1.length >= 8) phones.push({ phone: p1, label: 'MonCash reprezantan', isDefault: true });
  if (p2.length >= 8 && p2 !== p1) {
    phones.push({ phone: p2, label: 'MonCash dezyèm moun', isDefault: false });
  }

  const { data: defaultMoncash } = await admin
    .from('hatex_bank_accounts')
    .select('id')
    .eq('user_id', user.id)
    .eq('kind', 'moncash')
    .eq('is_default', true)
    .maybeSingle();

  for (const row of phones) {
    const { data: existing } = await admin
      .from('hatex_bank_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('kind', 'moncash')
      .eq('phone', row.phone)
      .maybeSingle();
    if (existing) continue;
    await admin.from('hatex_bank_accounts').insert({
      user_id: user.id,
      kind: 'moncash',
      label: row.label,
      phone: row.phone,
      is_default: row.isDefault && !defaultMoncash,
      is_verified: true,
    });
  }

  if (p1.length >= 8) {
    await admin
      .from('hatex_merchant_accounts')
      .update({ payout_phone: p1, payout_provider: 'moncash' })
      .eq('user_id', user.id);
  }

  return NextResponse.json({
    ok: true,
    status: 'submitted',
    next: '/kyc/v2',
    intended_plan: profile?.intended_plan || null,
  });
}
