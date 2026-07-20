import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { KYC_FEE_HTG } from '@/lib/kyc/fees';
import { resolvePlatformFee } from '@/lib/fees/platform';
import { KYC_STATUS } from '@/lib/kyc/status';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('wallet_balance, kyc_fee_paid, kyc_status')
    .eq('id', user.id)
    .single();

  const { data: discountRow } = await admin
    .from('user_discounts')
    .select('discount_amount')
    .eq('user_id', user.id)
    .maybeSingle();

  const discount = Number(discountRow?.discount_amount || 0);
  const baseFee = await resolvePlatformFee(admin, 'kyc_fee', user.id);
  const amountDue = Math.max(0, baseFee - Math.max(0, discount));

  return NextResponse.json({
    base_fee_htg: baseFee || KYC_FEE_HTG,
    discount_htg: discount,
    amount_due_htg: amountDue,
    wallet_balance_htg: Number(profile?.wallet_balance || 0),
    kyc_fee_paid: profile?.kyc_fee_paid === true,
    kyc_status: profile?.kyc_status,
    phase: 'submit',
    note: 'Premye 525 HTG pou soumèt dokiman. Dezyèm 525 HTG apre apwobasyon pou debloke kat/terminal/fakti.',
  });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`kyc-pay:${ip}`, 10, 3600);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, kyc_status, account_status')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Pwofil pa jwenn.' }, { status: 404 });
  }

  if (profile.account_status === 'suspended') {
    return NextResponse.json({ error: 'Kont ou sispandi.' }, { status: 403 });
  }

  if (profile.kyc_status === KYC_STATUS.APPROVED) {
    return NextResponse.json({ error: 'KYC ou deja apwouve.' }, { status: 400 });
  }

  const { data: rpcRaw, error: rpcErr } = await admin.rpc('process_kyc_fee', {
    p_user_id: user.id,
  });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message || 'Pa t kapab debite wallet la.' }, { status: 500 });
  }

  const result = typeof rpcRaw === 'string' ? JSON.parse(rpcRaw) : rpcRaw;
  if (!result?.success) {
    const status = result?.needs_deposit ? 400 : 400;
    return NextResponse.json(
      {
        error: result?.message || 'Pa t kapab peye frè KYC.',
        amount_due_htg: result?.amount_due_htg,
        wallet_balance_htg: result?.wallet_balance_htg,
        needs_deposit: result?.needs_deposit,
      },
      { status }
    );
  }

  if (result.already_paid) {
    return NextResponse.json({ success: true, already_paid: true, message: 'Frè KYC deja peye.' });
  }

  return NextResponse.json({
    success: true,
    charged_htg: result.charged_htg,
    wallet_balance_htg: result.wallet_balance_htg,
    message: 'Frè soumèt KYC peye (525 HTG). Ou ka telechaje dokiman yo kounye a.',
  });
}
