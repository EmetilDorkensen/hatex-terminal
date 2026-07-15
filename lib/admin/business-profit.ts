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

export type BusinessProfitSummary = {
  gross_htg: number;
  withdrawn_htg: number;
  available_htg: number;
  kes_global_htg: number;
  breakdown: BusinessProfitBreakdown;
};

function sumAbs(rows: { amount?: number | null }[] | null | undefined): number {
  return (rows || []).reduce((acc, f) => acc + Math.abs(Number(f.amount || 0)), 0);
}

function sumFee(rows: { fee?: number | null }[] | null | undefined): number {
  return (rows || []).reduce((acc, d) => acc + Number(d.fee || 0), 0);
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
    depo: Number(sumFee(depData).toFixed(2)),
    retre: Number(sumFee(witData).toFixed(2)),
    transfe: Number((totalTransfeFeeOld + sumAbs(transferFeeData)).toFixed(2)),
    ajan_aktivasyon: Number(sumAbs(feeData).toFixed(2)),
    ajan_retrè_hatex: Number(sumAbs(agentWithdrawFeeData).toFixed(2)),
    antrepriz: Number(sumAbs(entFeeData).toFixed(2)),
    kat: Number(sumAbs(cardFeeData).toFixed(2)),
    kyc: Number(sumAbs(kycFeeData).toFixed(2)),
    api: Number(sumAbs(apiFeeData).toFixed(2)),
  };
}

export function sumBreakdown(b: BusinessProfitBreakdown): number {
  return Number(
    (
      b.depo +
      b.retre +
      b.transfe +
      b.ajan_aktivasyon +
      b.ajan_retrè_hatex +
      b.antrepriz +
      b.kat +
      b.kyc +
      b.api
    ).toFixed(2)
  );
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
  const breakdown = await getBusinessProfitBreakdown(supabase);
  const gross = sumBreakdown(breakdown);
  const withdrawn = await getTotalBusinessWithdrawn(supabase);
  const available = Math.max(0, Number((gross - withdrawn).toFixed(2)));

  const { data: treasury } = await supabase
    .from('platform_treasury')
    .select('balance')
    .eq('id', 'kes_global')
    .maybeSingle();

  return {
    gross_htg: Number(gross.toFixed(2)),
    withdrawn_htg: Number(withdrawn.toFixed(2)),
    available_htg: available,
    kes_global_htg: Number(treasury?.balance || 0),
    breakdown,
  };
}
