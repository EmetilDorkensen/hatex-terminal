import type { SupabaseClient } from '@supabase/supabase-js';
import { haitiDayBounds } from './haiti-day';
import {
  PAYER_LIMIT_MESSAGE,
  dailyLimitFor,
  effectivePlan,
  type ProfilePlanRow,
} from './plans';
import { getGatewaySettings } from '@/lib/moncash/settings';

const RECEIVE_PURPOSES = ['merchant', 'invoice', 'product'] as const;

export type ReceiveLimitOk = {
  ok: true;
  used: number;
  remaining: number | null;
  limit: number | null;
  plan: string;
  day: string;
};

export type ReceiveLimitBlocked = {
  ok: false;
  code: 'merchant_limit_reached';
  message: string;
  used: number;
  remaining: number;
  limit: number;
  plan: string;
  day: string;
};

export type ReceiveLimitResult = ReceiveLimitOk | ReceiveLimitBlocked;

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR');
}

async function loadPlan(
  admin: SupabaseClient,
  merchantId: string
): Promise<ProfilePlanRow> {
  const { data } = await admin
    .from('profiles')
    .select('plan, plan_status, plan_period_end, intended_plan, kyc_status')
    .eq('id', merchantId)
    .maybeSingle();
  return (data as ProfilePlanRow) || {};
}

/**
 * Total kòb machann nan deja RESEVWA jodi a (peye) + peman pending ki poko ekspire.
 * Sa kouvri API, fakti, lyen piblik — tout hatex_payments ki voye kòb ba li.
 */
export async function merchantReceivedTodayHtg(
  admin: SupabaseClient,
  merchantId: string
): Promise<{ used: number; day: string }> {
  const { startIso, endIso, day } = haitiDayBounds();

  const { data: payments } = await admin
    .from('hatex_payments')
    .select('merchant_amount, status, paid_at, created_at, expires_at, purpose')
    .eq('merchant_id', merchantId)
    .in('purpose', [...RECEIVE_PURPOSES])
    .in('status', ['paid', 'pending']);

  let used = 0;
  const now = Date.now();
  for (const row of payments || []) {
    const amount = Number(row.merchant_amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (row.status === 'paid') {
      const at = new Date(row.paid_at || row.created_at).getTime();
      if (at >= Date.parse(startIso) && at < Date.parse(endIso)) used += amount;
      continue;
    }
    // pending: rezève kota a pou pa kite de peman pase an menm tan
    const created = new Date(row.created_at).getTime();
    if (created < Date.parse(startIso) || created >= Date.parse(endIso)) continue;
    if (row.expires_at && Date.parse(row.expires_at) < now) continue;
    used += amount;
  }

  return { used, day };
}

/**
 * Verifye AVAN nou ouvri bouton MonCash / kreye peman.
 * Si limit jou a rive, kliyan an wè mesaj machann pa elaji.
 */
export async function checkMerchantDailyReceive(
  admin: SupabaseClient,
  merchantId: string,
  incomingAmount: number
): Promise<ReceiveLimitResult> {
  const profile = await loadPlan(admin, merchantId);
  const plan = effectivePlan(profile);
  const settings = await getGatewaySettings(admin);
  const limit = dailyLimitFor(profile, {
    free: settings.daily_limit_free_htg,
    capacity: settings.daily_limit_capacity_htg,
  });
  const { used, day } = await merchantReceivedTodayHtg(admin, merchantId);
  const amount = Math.round(Number(incomingAmount) || 0);

  if (limit == null) {
    return { ok: true, used, remaining: null, limit: null, plan, day };
  }

  const remaining = Math.max(limit - used, 0);
  if (amount > remaining) {
    return {
      ok: false,
      code: 'merchant_limit_reached',
      message: PAYER_LIMIT_MESSAGE,
      used,
      remaining,
      limit,
      plan,
      day,
    };
  }

  return { ok: true, used, remaining: remaining - amount, limit, plan, day };
}

export function describeLimitForMerchant(result: ReceiveLimitResult): string {
  if (result.limit == null) {
    return `Plan Premyòm — san limit jou. Ou deja resevwa ${fmt(result.used)} HTG jodi a.`;
  }
  return (
    `Plan ${result.plan}: ${fmt(result.used)} / ${fmt(result.limit)} HTG jodi a. ` +
    `Rès: ${fmt(result.remaining ?? 0)} HTG.`
  );
}
