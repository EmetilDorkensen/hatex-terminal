import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_FEE_CONFIG, type FeeConfig } from './fees';
import { getMonCashMode } from './config';

export type GatewayLimits = {
  max_amount_per_tx_htg: number;
  min_amount_per_tx_htg: number;
  limit_individual_month_htg: number;
  limit_business_month_htg: number;
  payment_link_ttl_minutes: number;
  kyc_fee_individual_htg: number;
  kyc_fee_business_htg: number;
  plan_capacity_price_htg: number;
  plan_premium_price_htg: number;
  daily_limit_free_htg: number;
  daily_limit_capacity_htg: number;
  /** To konvèsyon payout bank: 1 USD = X HTG. */
  payout_usd_htg_rate: number;
};

export const DEFAULT_LIMITS: GatewayLimits = {
  max_amount_per_tx_htg: 100000,
  min_amount_per_tx_htg: 10,
  limit_individual_month_htg: 250000,
  limit_business_month_htg: 2000000,
  payment_link_ttl_minutes: 15,
  kyc_fee_individual_htg: 1920,
  kyc_fee_business_htg: 1920,
  plan_capacity_price_htg: 599,
  plan_premium_price_htg: 999,
  daily_limit_free_htg: 25000,
  daily_limit_capacity_htg: 150000,
  payout_usd_htg_rate: 132,
};

export type GatewaySettings = FeeConfig & GatewayLimits;

const CACHE_TTL_MS = 30000;
let cache: { at: number; value: GatewaySettings } | null = null;

/** Li konfigirasyon pasrèl la nan baz done a (frè + limit), ak yon ti cache. */
export async function getGatewaySettings(
  admin: SupabaseClient,
  options?: { fresh?: boolean }
): Promise<GatewaySettings> {
  const now = Date.now();
  if (!options?.fresh && cache && now - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  const fallback: GatewaySettings = { ...DEFAULT_FEE_CONFIG, ...DEFAULT_LIMITS };

  const { data, error } = await admin
    .from('hatex_gateway_settings')
    .select('key, value');

  if (error || !data?.length) {
    return fallback;
  }

  const merged = { ...fallback };
  for (const row of data) {
    const key = String(row.key) as keyof GatewaySettings;
    if (key in merged) {
      const num = Number(row.value);
      if (Number.isFinite(num)) merged[key] = num;
    }
  }

  cache = { at: now, value: merged };
  return merged;
}

export function resetGatewaySettingsCache(): void {
  cache = null;
}

/**
 * Frè KYC kliyan an dwe peye.
 * Sandbox: kont tès yo pa gen 1920 HTG — nou mande minimòm MonCash (10 HTG).
 * Live: frè ofisyèl 1920 HTG.
 */
export function resolveKycFeeHtg(
  settings: GatewaySettings,
  accountType: 'individual' | 'business'
): number {
  if (getMonCashMode() !== 'live') {
    return Math.max(Math.round(settings.min_amount_per_tx_htg || 10), 10);
  }
  const fee =
    accountType === 'business'
      ? settings.kyc_fee_business_htg
      : settings.kyc_fee_individual_htg;
  return Math.round(fee);
}
