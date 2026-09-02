import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { hasSubmittedKyc } from '@/lib/billing/kyc-gate';
import {
  PLANS,
  effectivePlan,
  isPaidPlanId,
  type PlanId,
} from '@/lib/billing/plans';
import { ensureMerchantGatewayAccount } from '@/lib/billing/provision';
import { checkMerchantDailyReceive } from '@/lib/billing/receive-limit';
import { listMoncashPhones } from '@/lib/payouts/phones';
import { getGatewaySettings } from '@/lib/moncash/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('plan, plan_status, plan_period_end, intended_plan, kyc_status')
    .eq('id', user.id)
    .maybeSingle();

  const usage = await checkMerchantDailyReceive(admin, user.id, 0);
  const phones = await listMoncashPhones(admin, user.id);
  const settings = await getGatewaySettings(admin);

  const { data: walletFull } = await admin
    .from('hatex_payouts')
    .select('id, amount, last_error, hold_until, created_at, receiver_phone')
    .eq('merchant_id', user.id)
    .eq('wallet_full', true)
    .in('status', ['pending', 'failed'])
    .is('considered_lost_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    plans: Object.values(PLANS),
    profile: {
      plan: profile?.plan || null,
      plan_status: profile?.plan_status || 'none',
      plan_period_end: profile?.plan_period_end || null,
      intended_plan: profile?.intended_plan || null,
      kyc_status: profile?.kyc_status || null,
      effective_plan: effectivePlan(profile),
    },
    usage,
    moncash_count: phones.length,
    wallet_full_payouts: walletFull || [],
    needs_plan: !profile?.plan,
    prices: {
      capacity: settings.plan_capacity_price_htg,
      premium: settings.plan_premium_price_htg,
    },
  });
}

export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated' } }, { status: 401 });
  }

  const rl = await rateLimit(`pick-plan:${user.id}:${getClientIp(request)}`, 20, 600);
  if (!rl.allowed) {
    return NextResponse.json({ error: { code: 'rate_limited' } }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const plan = String(body?.plan || '') as PlanId;
  if (!['free', 'capacity', 'premium'].includes(plan)) {
    return NextResponse.json(
      { error: { code: 'invalid_plan', message: 'Chwazi Gratis, Kapasite oswa Premyòm.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('plan, plan_status, plan_period_end, kyc_status')
    .eq('id', user.id)
    .maybeSingle();

  const now = new Date().toISOString();
  const kycSubmitted = await hasSubmittedKyc(admin, user.id);

  if (plan === 'free') {
    await admin
      .from('profiles')
      .update({
        plan: 'free',
        plan_status: 'active',
        plan_selected_at: now,
        intended_plan: null,
        plan_period_end: null,
      })
      .eq('id', user.id);

    await ensureMerchantGatewayAccount(admin, user.id);

    return NextResponse.json({ ok: true, plan: 'free', next: 'dashboard' });
  }

  if (!isPaidPlanId(plan)) {
    return NextResponse.json({ error: { code: 'invalid_plan' } }, { status: 400 });
  }

  const def = PLANS[plan];

  if (!kycSubmitted) {
    await admin
      .from('profiles')
      .update({
        plan: 'free',
        plan_status: 'pending_kyc',
        plan_selected_at: now,
        intended_plan: plan,
      })
      .eq('id', user.id);

    await ensureMerchantGatewayAccount(admin, user.id);

    await admin.from('hatex_plan_subscriptions').insert({
      user_id: user.id,
      plan,
      status: 'pending_kyc',
      amount_htg: def.monthlyPriceHtg,
    });

    return NextResponse.json({
      ok: true,
      plan,
      next: 'kyc',
      message: 'Konplete KYC anvan ou peye abonnman an. Ou ka sèvi ak plan Gratis (25 000 HTG/jou) pandan w ap tann.',
    });
  }

  await admin
    .from('profiles')
    .update({
      plan: profile?.plan_status === 'active' && profile.plan === plan ? plan : 'free',
      plan_status: 'pending_payment',
      plan_selected_at: now,
      intended_plan: plan,
    })
    .eq('id', user.id);

  await ensureMerchantGatewayAccount(admin, user.id);

  await admin.from('hatex_plan_subscriptions').insert({
    user_id: user.id,
    plan,
    status: 'pending_payment',
    amount_htg: def.monthlyPriceHtg,
  });

  return NextResponse.json({
    ok: true,
    plan,
    next: 'pay',
    amount_htg: def.monthlyPriceHtg,
  });
}
