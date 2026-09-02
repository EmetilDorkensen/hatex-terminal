import type { SupabaseClient } from '@supabase/supabase-js';
import { getGatewaySettings } from '@/lib/moncash/settings';

const DEFAULT_RATE = 132;

/**
 * To konvèsyon HTG → USD pou payout bank (paramèt payout_usd_htg_rate
 * nan hatex_gateway_settings — admin ka chanje l nan paj Frè).
 */
export async function getPayoutUsdRate(admin: SupabaseClient): Promise<number> {
  const settings = await getGatewaySettings(admin, { fresh: true });
  const rate = Number(settings.payout_usd_htg_rate);
  if (!Number.isFinite(rate) || rate <= 0) return DEFAULT_RATE;
  return rate;
}

/** Konvèti yon montan HTG an USD ak to a (1 USD = X HTG). */
export function convertHtgToUsd(amountHtg: number, htgPerUsd: number): number {
  const amount = Number(amountHtg);
  const rate = Number(htgPerUsd);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) {
    return 0;
  }
  return Math.round((amount / rate) * 100) / 100;
}

/** Konvèti yon montan USD an HTG ak to a (1 USD = X HTG). */
export function convertUsdToHtg(amountUsd: number, htgPerUsd: number): number {
  const amount = Number(amountUsd);
  const rate = Number(htgPerUsd);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) {
    return 0;
  }
  return Math.round(amount * rate * 100) / 100;
}
