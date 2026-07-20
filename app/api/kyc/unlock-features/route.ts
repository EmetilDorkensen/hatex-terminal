import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { KYC_UNLOCK_FEE_HTG } from '@/lib/kyc/fees';
import { resolvePlatformFee } from '@/lib/fees/platform';
import { KYC_STATUS } from '@/lib/kyc/status';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { provisionCardForUser } from '@/lib/kyc/card-provision';
import { ensureMerchantApiCredentials } from '@/lib/security/merchant-provisioning';

/** Estati debloke (kat / terminal / invoice). */
export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('wallet_balance, kyc_status, features_unlock_paid, is_card_activated')
    .eq('id', user.id)
    .single();

  const unlockFee = await resolvePlatformFee(admin, 'card_activation_fee', user.id);

  return NextResponse.json({
    unlock_fee_htg: unlockFee || KYC_UNLOCK_FEE_HTG,
    wallet_balance_htg: Number(profile?.wallet_balance || 0),
    kyc_status: profile?.kyc_status,
    features_unlock_paid: profile?.features_unlock_paid === true,
    is_card_activated: profile?.is_card_activated === true,
    can_unlock:
      profile?.kyc_status === KYC_STATUS.APPROVED && profile?.features_unlock_paid !== true,
  });
}

/**
 * Peye dezyèm 525 HTG (RPC) epi debloke kat / terminal / invoice.
 * Montan soti nan baz — pa nan navigatè.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`kyc-unlock:${ip}`, 10, 3600);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  const { data: rpcRaw, error: rpcErr } = await admin.rpc('process_features_unlock_fee', {
    p_user_id: user.id,
  });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message || 'Pa t kapab debite wallet la.' }, { status: 500 });
  }

  const result = typeof rpcRaw === 'string' ? JSON.parse(rpcRaw) : rpcRaw;
  if (!result?.success) {
    return NextResponse.json(
      {
        error: result?.message || 'Pa t kapab debloke opsyon yo.',
        amount_due_htg: result?.amount_due_htg,
        wallet_balance_htg: result?.wallet_balance_htg,
        needs_deposit: result?.needs_deposit,
      },
      { status: 400 }
    );
  }

  // Asire kat + kredansyèl machann apre debloke (RPC deja mete flags)
  try {
    await provisionCardForUser(admin, user.id, { activate: true });
    const { data: fresh } = await admin
      .from('profiles')
      .select('id, kyc_status, is_card_activated, api_key_hash, api_key_prefix, is_merchant, webhook_secret')
      .eq('id', user.id)
      .single();
    if (fresh) {
      await ensureMerchantApiCredentials(admin, fresh);
    }
  } catch (e) {
    console.error('Unlock provision:', e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    success: true,
    already_paid: !!result.already_paid,
    charged_htg: result.charged_htg ?? 0,
    wallet_balance_htg: result.wallet_balance_htg,
    message: result.already_paid
      ? 'Opsyon yo deja debloke.'
      : 'Kat, terminal ak fakti debloke. Ou ka itilize yo kounye a.',
  });
}
