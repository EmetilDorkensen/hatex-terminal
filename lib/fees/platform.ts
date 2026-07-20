import type { SupabaseClient } from '@supabase/supabase-js';

export const FEE_KEYS = [
  'kyc_fee',
  'deposit_fee_percent',
  'withdraw_fee_percent',
  'transfer_fee_percent',
  'agent_fee_per_1000',
  'agent_withdraw_fee_per_1000',
  'api_fee_per_1000',
  'enterprise_application_fee',
  'card_activation_fee',
] as const;

export type FeeKey = (typeof FEE_KEYS)[number];

const DEFAULTS: Record<FeeKey, number> = {
  kyc_fee: 525,
  deposit_fee_percent: 5,
  withdraw_fee_percent: 5,
  transfer_fee_percent: 5,
  agent_fee_per_1000: 7,
  agent_withdraw_fee_per_1000: 50,
  api_fee_per_1000: 3,
  enterprise_application_fee: 49000,
  card_activation_fee: 525,
};

/** Rezoud frè depi baz (override kont > global > default). */
export async function resolvePlatformFee(
  db: SupabaseClient,
  feeKey: FeeKey,
  userId?: string | null
): Promise<number> {
  const fallback = DEFAULTS[feeKey] ?? 0;
  try {
    const { data, error } = await db.rpc('hatex_resolve_fee', {
      p_fee_key: feeKey,
      p_user_id: userId || null,
      p_default: fallback,
    });
    if (error) return fallback;
    const n = Number(data);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

export function feeFromPercent(amount: number, percent: number): number {
  return Math.round(amount * (percent / 100) * 100) / 100;
}

export function feePerThousand(amount: number, per1000: number): number {
  return Math.round((amount / 1000) * per1000 * 100) / 100;
}
