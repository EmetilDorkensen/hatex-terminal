import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { KYC_STATUS } from '@/lib/kyc/status';
import { provisionCardForUser } from '@/lib/kyc/card-provision';
import { ensureMerchantApiCredentials } from '@/lib/security/merchant-provisioning';

/**
 * ANSYEN: dezyèm 525 HTG pou "debloke" kat / terminal / invaris.
 * Kounye a otomatik. KYC apwouve = tout bagay debloke. Endpoint la kenbe pou
 * paj UI ki poko refwadi — li senpleman ekri stati a.
 */
export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('kyc_status')
    .eq('id', user.id)
    .single();

  const kycApproved = profile?.kyc_status === KYC_STATUS.APPROVED;

  return NextResponse.json({
    unlock_fee_htg: 0,
    wallet_balance_htg: 0,
    kyc_status: profile?.kyc_status,
    features_unlock_paid: kycApproved,
    is_card_activated: kycApproved,
    can_unlock: false,
  });
}

/**
 * Kenbe POST kòm no-op pou konpatibilite: si UI eseye peye, nou tou senpleman
 * debloke opsyon yo pou kliyan KYC apwouve.
 */
export async function POST() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('kyc_status')
    .eq('id', user.id)
    .single();

  if (profile?.kyc_status !== KYC_STATUS.APPROVED) {
    return NextResponse.json(
      { error: 'KYC ou dwe apwouve anvan opsyon yo debloke.' },
      { status: 400 }
    );
  }

  await admin
    .from('profiles')
    .update({ features_unlock_paid: true, is_card_activated: true })
    .eq('id', user.id);

  try {
    await provisionCardForUser(admin, user.id, { activate: true });
    const { data: fresh } = await admin
      .from('profiles')
      .select('id, kyc_status, is_card_activated, api_key_hash, api_key_prefix, is_merchant, webhook_secret')
      .eq('id', user.id)
      .single();
    if (fresh) await ensureMerchantApiCredentials(admin, fresh);
  } catch (e) {
    console.error('Unlock provision:', e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    success: true,
    already_paid: true,
    charged_htg: 0,
    wallet_balance_htg: 0,
    message: 'Tout opsyon debloke otomatikman — pa gen frè aktivasyon ankò.',
  });
}
