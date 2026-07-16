import type { SupabaseClient } from '@supabase/supabase-js';

export type BusinessProfitBreakdown = {
  depo: number;
  retre: number;
  transfe: number;
  /** Frè aktivasyon / kapasite ajan (type FEE) — PA enkli 20% komisyon ajan */
  ajan_aktivasyon: number;
  /** 80% frè retrè kay ajan (AGENT_WITHDRAW_FEE) — PA enkli 20% ajan */
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
  /** Frè brut kolèkte (anvan ranbousman) */
  gross_htg: number;
  /** Total FEE_REFUND (soti nan pwofi) */
  refunded_htg: number;
  /** gross - refunded */
  net_htg: number;
  withdrawn_htg: number;
  /** net - withdrawn (sa ki rete / disponib) */
  available_htg: number;
  kes_global_htg: number;
  breakdown: BusinessProfitBreakdown;
  /** Breakdown net (apre ranbousman pa kategori) */
  breakdown_net: BusinessProfitBreakdown;
  refunds: FeeRefundBreakdown;
};

function sumAbs(rows: { amount?: number | null }[] | null | undefined): number {
  return (rows || []).reduce((acc, f) => acc + Math.abs(Number(f.amount || 0)), 0);
}

function sumFee(rows: { fee?: number | null }[] | null | undefined): number {
  return (rows || []).reduce((acc, d) => acc + Number(d.fee || 0), 0);
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * Tout frè HatexCard pou tablo pwofi biznis.
 * EKSKLI: AGENT_COMMISSION (20% ajan) — pa manyen.
 */
export async function getBusinessProfitBreakdown(
  supabase: SupabaseClient
): Promise<BusinessProfitBreakdown> {
  const [
    { data: depData },
    { data: witData },
    { data: traData },
    { data: transferFeeData },
    { data: feeData },
    { data: entFeeData },
    { data: cardFeeData },
    { data: kycFeeData },
    { data: apiFeeData },
    { data: agentWithdrawFeeData },
  ] = await Promise.all([
    supabase.from('deposits').select('fee').eq('status', 'approved'),
    supabase.from('withdrawals').select('fee').eq('status', 'completed'),
    supabase.from('transfers').select('fee, status'),
    supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'TRANSFER_FEE')
      .eq('status', 'success'),
    supabase.from('transactions').select('amount').eq('type', 'FEE').eq('status', 'success'),
    supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'ENTERPRISE_FEE')
      .eq('status', 'success'),
    supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'CARD_ACTIVATION')
      .eq('status', 'success'),
    supabase.from('transactions').select('amount').eq('type', 'KYC_FEE').eq('status', 'success'),
    supabase.from('transactions').select('amount').eq('type', 'API_FEE').eq('status', 'success'),
    // 80% sèlman — pa AGENT_COMMISSION
    supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'AGENT_WITHDRAW_FEE')
      .eq('status', 'success'),
  ]);

  const totalTransfeFeeOld = (traData || [])
    .filter((t) => !t.status || t.status === 'success' || t.status === 'completed')
    .reduce((acc, t) => acc + Number(t.fee || 0), 0);

  return {
    depo: round2(sumFee(depData)),
    retre: round2(sumFee(witData)),
    transfe: round2(totalTransfeFeeOld + sumAbs(transferFeeData)),
    ajan_aktivasyon: round2(sumAbs(feeData)),
    ajan_retrè_hatex: round2(sumAbs(agentWithdrawFeeData)),
    antrepriz: round2(sumAbs(entFeeData)),
    kat: round2(sumAbs(cardFeeData)),
    kyc: round2(sumAbs(kycFeeData)),
    api: round2(sumAbs(apiFeeData)),
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
  supabase: SupabaseClient
): Promise<FeeRefundBreakdown> {
  const { data } = await supabase
    .from('transactions')
    .select('amount, description, metadata')
    .eq('type', 'FEE_REFUND')
    .eq('status', 'success');

  let ajan = 0;
  let antrepriz = 0;
  let kyc = 0;
  let api = 0;
  let lot = 0;

  for (const row of data || []) {
    const amt = Math.abs(Number(row.amount || 0));
    const cat = String((row.metadata as { category?: string } | null)?.category || '').toLowerCase();
    const desc = String(row.description || '').toLowerCase();

    if (cat.includes('agent') || desc.includes('ajan')) ajan += amt;
    else if (cat.includes('enterprise') || desc.includes('antrepriz')) antrepriz += amt;
    else if (cat.includes('kyc') || desc.includes('kyc')) kyc += amt;
    else if (cat.includes('api') || desc.includes('api')) api += amt;
    else lot += amt;
  }

  return {
    ajan: round2(ajan),
    antrepriz: round2(antrepriz),
    kyc: round2(kyc),
    api: round2(api),
    lòt: round2(lot),
    total: round2(ajan + antrepriz + kyc + api + lot),
  };
}

function applyRefundsToBreakdown(
  gross: BusinessProfitBreakdown,
  refunds: FeeRefundBreakdown
): BusinessProfitBreakdown {
  const ajanGross = gross.ajan_aktivasyon + gross.ajan_retrè_hatex;
  const ajanNet = Math.max(0, ajanGross - refunds.ajan);
  // Prefer subtract from activation first
  const ajanAktNet = Math.max(0, gross.ajan_aktivasyon - Math.min(refunds.ajan, gross.ajan_aktivasyon));
  const ajanRetNet = Math.max(0, ajanNet - ajanAktNet);

  return {
    depo: gross.depo,
    retre: gross.retre,
    transfe: gross.transfe,
    ajan_aktivasyon: round2(ajanAktNet),
    ajan_retrè_hatex: round2(ajanRetNet),
    antrepriz: round2(Math.max(0, gross.antrepriz - refunds.antrepriz)),
    kat: gross.kat,
    kyc: round2(Math.max(0, gross.kyc - refunds.kyc)),
    api: round2(Math.max(0, gross.api - refunds.api)),
  };
}

export async function calculateGrossBusinessProfit(
  supabase: SupabaseClient
): Promise<number> {
  return sumBreakdown(await getBusinessProfitBreakdown(supabase));
}

export async function getTotalBusinessWithdrawn(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from('business_profit_withdrawals').select('amount');
  return (data || []).reduce((acc, row) => acc + Number(row.amount || 0), 0);
}

export async function getBusinessProfitSummary(
  supabase: SupabaseClient
): Promise<BusinessProfitSummary> {
  const [breakdown, refunds, withdrawn] = await Promise.all([
    getBusinessProfitBreakdown(supabase),
    getFeeRefundBreakdown(supabase),
    getTotalBusinessWithdrawn(supabase),
  ]);

  const gross = sumBreakdown(breakdown);
  const net = round2(Math.max(0, gross - refunds.total));
  const available = round2(Math.max(0, net - withdrawn));
  const breakdown_net = applyRefundsToBreakdown(breakdown, refunds);

  const { data: treasury } = await supabase
    .from('platform_treasury')
    .select('balance')
    .eq('id', 'kes_global')
    .maybeSingle();

  return {
    gross_htg: round2(gross),
    refunded_htg: refunds.total,
    net_htg: net,
    withdrawn_htg: round2(withdrawn),
    available_htg: available,
    kes_global_htg: Number(treasury?.balance || 0),
    breakdown,
    breakdown_net,
    refunds,
  };
}
