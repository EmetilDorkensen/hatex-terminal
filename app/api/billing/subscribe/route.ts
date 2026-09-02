import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createMonCashPayment } from '@/lib/moncash/client';
import { getMonCashConfigForGateway, getMonCashMode, type GatewayMode } from '@/lib/moncash/config';
import { getGatewaySettings } from '@/lib/moncash/settings';
import { hasSubmittedKyc } from '@/lib/billing/kyc-gate';
import { PLANS, isPaidPlanId, type PlanId } from '@/lib/billing/plans';
import { publicSiteUrl } from '@/lib/urls/public';

export const dynamic = 'force-dynamic';

function mode(): GatewayMode {
  return getMonCashMode() === 'live' ? 'live' : 'test';
}

function planPrice(wanted: 'capacity' | 'premium', settings: { plan_capacity_price_htg: number; plan_premium_price_htg: number }): number {
  if (wanted === 'premium') return Math.round(settings.plan_premium_price_htg || PLANS.premium.monthlyPriceHtg);
  return Math.round(settings.plan_capacity_price_htg || PLANS.capacity.monthlyPriceHtg);
}

/** Kreye peman MonCash pou abonnman Kapasite / Premyòm. */
export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated' } }, { status: 401 });
  }

  const rl = await rateLimit(`plan-pay:${user.id}:${getClientIp(request)}`, 12, 600);
  if (!rl.allowed) {
    return NextResponse.json({ error: { code: 'rate_limited' } }, { status: 429 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('plan, plan_status, intended_plan, kyc_status')
    .eq('id', user.id)
    .maybeSingle();

  const body = await request.json().catch(() => ({}));
  const wanted = String(body?.plan || profile?.intended_plan || '') as PlanId;
  const returnTo = String(body?.return_to || '') === 'kyc' ? 'kyc' : 'plan';

  if (!isPaidPlanId(wanted)) {
    return NextResponse.json(
      { error: { code: 'invalid_plan', message: 'Chwazi Kapasite oswa Premyòm.' } },
      { status: 400 }
    );
  }

  if (!(await hasSubmittedKyc(admin, user.id))) {
    return NextResponse.json(
      {
        error: {
          code: 'kyc_required',
          message: 'Soumèt dokiman KYC yo anvan ou peye abonnman sa a.',
        },
      },
      { status: 409 }
    );
  }

  const def = PLANS[wanted];
  const settings = await getGatewaySettings(admin, { fresh: true });
  const amountHtg = planPrice(wanted, settings);
  const gwMode = mode();
  let cfg;
  try {
    cfg = getMonCashConfigForGateway(gwMode);
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: 'moncash_unavailable',
          message: e instanceof Error ? e.message : 'MonCash pa konfigire.',
        },
      },
      { status: 503 }
    );
  }

  const gatewayOrderId = `hxplan_${crypto.randomBytes(14).toString('hex')}`;
  const created = await createMonCashPayment(gatewayOrderId, amountHtg, cfg);
  if (!created.ok) {
    return NextResponse.json(
      { error: { code: 'provider_error', message: created.message } },
      { status: 502 }
    );
  }

  const site = publicSiteUrl();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const { data: payment, error } = await admin
    .from('hatex_payments')
    .insert({
      merchant_id: user.id,
      mode: gwMode,
      purpose: 'plan_fee',
      status: 'pending',
      merchant_order_id: `plan_${wanted}_${Date.now()}`,
      gateway_order_id: gatewayOrderId,
      merchant_amount: 0,
      platform_fee: amountHtg,
      payout_fee: 0,
      client_total: amountHtg,
      moncash_token: created.data.token,
      description: `Abonnman ${def.name} HatexCard`,
      return_url: `${site}${returnTo === 'kyc' ? '/kyc/v2' : '/plan'}`,
      expires_at: expiresAt,
      metadata: { plan: wanted },
    })
    .select('id')
    .maybeSingle();

  if (error || !payment) {
    return NextResponse.json(
      { error: { code: 'storage_error', message: error?.message || 'Pa t kapab sere peman an.' } },
      { status: 500 }
    );
  }

  await admin
    .from('profiles')
    .update({
      intended_plan: wanted,
      plan_status: 'pending_payment',
    })
    .eq('id', user.id);

  return NextResponse.json({
    ok: true,
    checkout_url: created.data.redirectUrl,
    amount: amountHtg,
    payment_id: payment.id,
  });
}
