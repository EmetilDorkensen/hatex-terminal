import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { computeKycFeeAmount, KYC_FEE_HTG } from '@/lib/kyc/fees';
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
  const amountDue = computeKycFeeAmount(discount);

  return NextResponse.json({
    base_fee_htg: KYC_FEE_HTG,
    discount_htg: discount,
    amount_due_htg: amountDue,
    wallet_balance_htg: Number(profile?.wallet_balance || 0),
    kyc_fee_paid: profile?.kyc_fee_paid === true,
    kyc_status: profile?.kyc_status,
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
    .select('id, wallet_balance, kyc_fee_paid, kyc_status, account_status')
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

  if (profile.kyc_fee_paid) {
    return NextResponse.json({ success: true, already_paid: true, message: 'Frè KYC deja peye.' });
  }

  const { data: discountRow } = await admin
    .from('user_discounts')
    .select('discount_amount')
    .eq('user_id', user.id)
    .maybeSingle();

  const discount = Number(discountRow?.discount_amount || 0);
  const charge = computeKycFeeAmount(discount);
  const balance = Number(profile.wallet_balance || 0);

  if (balance < charge) {
    return NextResponse.json(
      {
        error: `Ou pa gen ase kòb. Ou bezwen ${charge.toLocaleString()} HTG sou wallet ou. Fè yon depo anvan.`,
        amount_due_htg: charge,
        wallet_balance_htg: balance,
        needs_deposit: true,
      },
      { status: 400 }
    );
  }

  const newBalance = Number((balance - charge).toFixed(2));

  const { error: updateErr } = await admin
    .from('profiles')
    .update({ wallet_balance: newBalance, kyc_fee_paid: true })
    .eq('id', user.id);

  if (updateErr) {
    return NextResponse.json({ error: 'Pa t kapab debite wallet la.' }, { status: 500 });
  }

  await admin.from('transactions').insert({
    user_id: user.id,
    amount: -charge,
    type: 'KYC_FEE',
    status: 'success',
    description:
      discount > 0
        ? `Frè KYC konplè (kat enkli, rediksyon -${discount} HTG)`
        : 'Frè KYC konplè (verifikasyon ID + kat vityèl)',
  });

  return NextResponse.json({
    success: true,
    charged_htg: charge,
    wallet_balance_htg: newBalance,
    message: 'Frè KYC peye. Ou ka soumèt dokiman w yo kounye a.',
  });
}
