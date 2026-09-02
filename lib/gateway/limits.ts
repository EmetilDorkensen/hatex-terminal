import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayMode } from '@/lib/moncash/config';
import type { GatewaySettings } from '@/lib/moncash/settings';
import type { MerchantAccount } from './auth';

/**
 * Kontwòl limit peman.
 *
 * De nivo: limit global (nan `hatex_gateway_settings`, admin ka chanje) epi
 * limit espesifik pa machann (`per_tx_limit_htg` / `monthly_limit_htg`), ki
 * ranplase limit global la lè yo defini.
 *
 * Peman an mòd tès pa konte nan limit mwa a — sinon devlopè ta boushe kota li.
 */

export type LimitFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type LimitCheck = { ok: true } | LimitFailure;

function fmt(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} HTG`;
}

/** Limit mwa ki aplike pou yon machann, selon tip kont li. */
export function monthlyLimitFor(
  account: MerchantAccount,
  settings: GatewaySettings
): number {
  if (account.monthly_limit_htg != null && account.monthly_limit_htg > 0) {
    return Number(account.monthly_limit_htg);
  }
  return account.account_type === 'business'
    ? settings.limit_business_month_htg
    : settings.limit_individual_month_htg;
}

/** Limit pa tranzaksyon ki aplike pou yon machann. */
export function perTxLimitFor(
  account: MerchantAccount,
  settings: GatewaySettings
): number {
  if (account.per_tx_limit_htg != null && account.per_tx_limit_htg > 0) {
    return Math.min(Number(account.per_tx_limit_htg), settings.max_amount_per_tx_htg);
  }
  return settings.max_amount_per_tx_htg;
}

export function checkAmountLimits(
  merchantAmount: number,
  account: MerchantAccount,
  settings: GatewaySettings
): LimitCheck {
  if (!Number.isFinite(merchantAmount) || merchantAmount <= 0) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_amount',
      message: 'Montan an dwe yon nonb pozitif.',
    };
  }

  if (merchantAmount < settings.min_amount_per_tx_htg) {
    return {
      ok: false,
      status: 400,
      code: 'amount_too_small',
      message: `Montan minimòm se ${fmt(settings.min_amount_per_tx_htg)}.`,
    };
  }

  const perTx = perTxLimitFor(account, settings);
  if (merchantAmount > perTx) {
    return {
      ok: false,
      status: 400,
      code: 'amount_too_large',
      message: `Montan maksimòm pa tranzaksyon se ${fmt(perTx)}.`,
    };
  }

  return { ok: true };
}

/**
 * Verifye si peman sa a ap depase kota mwa machann nan.
 * Sèlman peman `live` konte.
 */
export async function checkMonthlyLimit(
  admin: SupabaseClient,
  merchantId: string,
  mode: GatewayMode,
  merchantAmount: number,
  account: MerchantAccount,
  settings: GatewaySettings
): Promise<LimitCheck> {
  if (mode !== 'live') return { ok: true };

  const limit = monthlyLimitFor(account, settings);
  if (!Number.isFinite(limit) || limit <= 0) return { ok: true };

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data, error } = await admin
    .from('hatex_payments')
    .select('merchant_amount')
    .eq('merchant_id', merchantId)
    .eq('mode', 'live')
    .eq('status', 'paid')
    .gte('paid_at', monthStart.toISOString());

  // Si nou pa ka li total la, pa bloke machann nan — men kite yon tras
  if (error) {
    console.error('[limits] Pa t kapab li volim mwa a:', error.message);
    return { ok: true };
  }

  const used = (data || []).reduce((sum, row) => sum + Number(row.merchant_amount || 0), 0);

  if (used + merchantAmount > limit) {
    const remaining = Math.max(limit - used, 0);
    return {
      ok: false,
      status: 409,
      code: 'monthly_limit_exceeded',
      message:
        `Kota mwa a rive: limit ${fmt(limit)}, ou deja resevwa ${fmt(used)}. ` +
        `Rès ki disponib: ${fmt(remaining)}.`,
    };
  }

  return { ok: true };
}
