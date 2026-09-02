import type { SupabaseClient } from '@supabase/supabase-js';

export type BusinessProfitBreakdown = {
  depo: number;
  retre: number;
  transfe: number;
  ajan_aktivasyon: number;
  ajan_retrè_hatex: number;
  antrepriz: number;
  kat: number;
  kyc: number;
  api: number;
};

export type FeeRefundBreakdown = {
  ajan: number;
  antrepriz: number;
  kyc: number;
  api: number;
  lòt: number;
  total: number;
};

export type BusinessProfitSummary = {
  gross_htg: number;
  refunded_htg: number;
  net_htg: number;
  withdrawn_htg: number;
  available_htg: number;
  ledger_balance_htg: number;
  kes_global_htg: number;
  breakdown: BusinessProfitBreakdown;
  breakdown_net: BusinessProfitBreakdown;
  refunds: FeeRefundBreakdown;
};

function round2(n: number): number {
  return Number(n.toFixed(2));
}

const EMPTY_BREAKDOWN: BusinessProfitBreakdown = {
  depo: 0,
  retre: 0,
  transfe: 0,
  ajan_aktivasyon: 0,
  ajan_retrè_hatex: 0,
  antrepriz: 0,
  kat: 0,
  kyc: 0,
  api: 0,
};

const EMPTY_REFUNDS: FeeRefundBreakdown = {
  ajan: 0,
  antrepriz: 0,
  kyc: 0,
  api: 0,
  lòt: 0,
  total: 0,
};

/**
 * Revni pasrèl soti nan hatex_payments (ansyen tab transactions retire).
 */
export async function getBusinessProfitBreakdown(
  supabase: SupabaseClient
): Promise<BusinessProfitBreakdown> {
  const { data } = await supabase
    .from('hatex_payments')
    .select('purpose, platform_fee, client_total, status')
    .eq('status', 'paid');

  let transfe = 0;
  let kyc = 0;
  let api = 0;

  for (const row of data || []) {
    const purpose = String(row.purpose || '');
    const fee = Number(row.platform_fee || 0);
    if (purpose === 'kyc_fee') {
      kyc += Number(row.client_total || fee);
    } else if (purpose === 'merchant' || purpose === 'invoice') {
      transfe += fee;
    } else if (purpose === 'plan_fee') {
      // Abonnman — pa nan breakdown transfe
    }
  }

  return {
    ...EMPTY_BREAKDOWN,
    transfe: round2(transfe),
    kyc: round2(kyc),
    api: round2(api),
  };
}

export function sumBreakdown(b: BusinessProfitBreakdown): number {
  return round2(
    b.depo +
      b.retre +
      b.transfe +
      b.ajan_aktivasyon +
      b.ajan_retrè_hatex +
      b.antrepriz +
      b.kat +
      b.kyc +
      b.api
  );
}

export async function getFeeRefundBreakdown(
  _supabase: SupabaseClient
): Promise<FeeRefundBreakdown> {
  return EMPTY_REFUNDS;
}

function applyRefundsToBreakdown(
  gross: BusinessProfitBreakdown,
  refunds: FeeRefundBreakdown
): BusinessProfitBreakdown {
  return {
    ...gross,
    kyc: round2(Math.max(0, gross.kyc - refunds.kyc)),
    api: round2(Math.max(0, gross.api - refunds.api)),
  };
}

export async function calculateGrossBusinessProfit(
  supabase: SupabaseClient
): Promise<number> {
  return sumBreakdown(await getBusinessProfitBreakdown(supabase));
}

export async function getTotalBusinessWithdrawn(_supabase: SupabaseClient): Promise<number> {
  return 0;
}

export async function getBusinessProfitAccountBalance(
  _supabase: SupabaseClient
): Promise<number> {
  return 0;
}

export async function getBusinessProfitSummary(
  supabase: SupabaseClient
): Promise<BusinessProfitSummary> {
  const [breakdown, refunds] = await Promise.all([
    getBusinessProfitBreakdown(supabase),
    getFeeRefundBreakdown(supabase),
  ]);

  const { data: paid } = await supabase
    .from('hatex_payments')
    .select('purpose, platform_fee, client_total')
    .eq('status', 'paid');

  let platformFees = 0;
  let planFees = 0;
  for (const row of paid || []) {
    const amount = Number(row.platform_fee || row.client_total || 0);
    if (row.purpose === 'plan_fee') planFees += Number(row.client_total || amount);
    else platformFees += Number(row.platform_fee || 0);
    if (row.purpose === 'kyc_fee') {
      // deja nan breakdown.kyc
    }
  }

  const gross = round2(platformFees + planFees);
  const net = round2(Math.max(0, gross - refunds.total));
  const breakdown_net = applyRefundsToBreakdown(breakdown, refunds);

  return {
    gross_htg: gross,
    refunded_htg: refunds.total,
    net_htg: net,
    withdrawn_htg: 0,
    available_htg: net,
    ledger_balance_htg: net,
    kes_global_htg: 0,
    breakdown,
    breakdown_net,
    refunds,
  };
}
