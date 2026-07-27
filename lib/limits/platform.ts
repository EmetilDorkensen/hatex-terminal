import type { SupabaseClient } from '@supabase/supabase-js';

export const LIMIT_KEYS = [
  'individual_daily_limit',
  'individual_monthly_limit',
  'individual_invoice_daily_limit',
  'individual_max_wallet',
  'enterprise_max_wallet',
  'enterprise_card_daily_limit',
  'enterprise_card_monthly_limit',
  'api_receive_individual',
  'api_receive_enterprise',
  'individual_withdraw_max_per_tx',
  'individual_withdraw_max_count_daily',
  'enterprise_withdraw_max_per_tx',
  'enterprise_withdraw_max_count_daily',
  'min_deposit',
  'min_withdraw',
  'vip_withdraw_threshold',
  'card_recharge_max',
  'agent_pro_capacity',
  'agent_premium_capacity',
  'agent_withdraw_share_rate',
] as const;

export type LimitKey = (typeof LIMIT_KEYS)[number];

const DEFAULTS: Record<LimitKey, number> = {
  individual_daily_limit: 75000,
  individual_monthly_limit: 250000,
  individual_invoice_daily_limit: 85000,
  individual_max_wallet: 1200000,
  enterprise_max_wallet: 12000000,
  enterprise_card_daily_limit: 100000,
  enterprise_card_monthly_limit: 480000,
  api_receive_individual: 1000000,
  api_receive_enterprise: 10000000,
  individual_withdraw_max_per_tx: 25000,
  individual_withdraw_max_count_daily: 5,
  enterprise_withdraw_max_per_tx: 75000,
  enterprise_withdraw_max_count_daily: 12,
  min_deposit: 500,
  min_withdraw: 500,
  vip_withdraw_threshold: 15000,
  card_recharge_max: 70000,
  agent_pro_capacity: 55000,
  agent_premium_capacity: 110000,
  agent_withdraw_share_rate: 0.2,
};

export async function resolvePlatformLimit(
  db: SupabaseClient,
  limitKey: LimitKey,
  fallback?: number
): Promise<number> {
  const def = fallback ?? DEFAULTS[limitKey] ?? 0;
  try {
    const { data, error } = await db.rpc('hatex_resolve_limit', {
      p_limit_key: limitKey,
      p_default: def,
    });
    if (error) return def;
    const n = Number(data);
    return Number.isFinite(n) && n >= 0 ? n : def;
  } catch {
    return def;
  }
}

export async function resolveAllPlatformLimits(db: SupabaseClient): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    LIMIT_KEYS.map(async (key) => {
      out[key] = await resolvePlatformLimit(db, key);
    })
  );
  return out;
}

export { DEFAULTS as LIMIT_DEFAULTS };
