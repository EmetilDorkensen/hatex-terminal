import type { SupabaseClient } from '@supabase/supabase-js';

export type BusinessProfitSummary = {
  gross_htg: number;
  withdrawn_htg: number;
  available_htg: number;
  kes_global_htg: number;
};

export async function calculateGrossBusinessProfit(
  supabase: SupabaseClient
): Promise<number> {
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
      .select('amount, status')
      .eq('type', 'TRANSFER_FEE')
      .eq('status', 'success'),
    supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'FEE')
      .eq('status', 'success'),
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
    supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'KYC_FEE')
      .eq('status', 'success'),
    supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'API_FEE')
      .eq('status', 'success'),
    // 80% frè retrè kay ajan → pwofi HatexCard
    supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'AGENT_WITHDRAW_FEE')
      .eq('status', 'success'),
  ]);

  const totalDepoFee = (depData || []).reduce((acc, d) => acc + Number(d.fee || 0), 0);
  const totalRetreFee = (witData || []).reduce((acc, w) => acc + Number(w.fee || 0), 0);
  const totalTransfeFeeOld = (traData || [])
    .filter((t) => !t.status || t.status === 'success' || t.status === 'completed')
    .reduce((acc, t) => acc + Number(t.fee || 0), 0);
  const totalTransferFeeNew = (transferFeeData || []).reduce(
    (acc, t) => acc + Math.abs(Number(t.amount || 0)),
    0
  );
  const totalTransfeFee = totalTransfeFeeOld + totalTransferFeeNew;
  const totalAgentFee = (feeData || []).reduce(
    (acc, f) => acc + Math.abs(Number(f.amount || 0)),
    0
  );
  const totalEnterpriseFee = (entFeeData || []).reduce(
    (acc, f) => acc + Math.abs(Number(f.amount || 0)),
    0
  );
  const totalCardFee = (cardFeeData || []).reduce(
    (acc, f) => acc + Math.abs(Number(f.amount || 0)),
    0
  );
  const totalKycFee = (kycFeeData || []).reduce(
    (acc, f) => acc + Math.abs(Number(f.amount || 0)),
    0
  );
  const totalApiFee = (apiFeeData || []).reduce(
    (acc, f) => acc + Math.abs(Number(f.amount || 0)),
    0
  );
  const totalAgentWithdrawHatexFee = (agentWithdrawFeeData || []).reduce(
    (acc, f) => acc + Math.abs(Number(f.amount || 0)),
    0
  );

  return (
    totalDepoFee +
    totalRetreFee +
    totalTransfeFee +
    totalAgentFee +
    totalEnterpriseFee +
    totalCardFee +
    totalKycFee +
    totalApiFee +
    totalAgentWithdrawHatexFee
  );
}

export async function getTotalBusinessWithdrawn(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from('business_profit_withdrawals').select('amount');
  return (data || []).reduce((acc, row) => acc + Number(row.amount || 0), 0);
}

export async function getBusinessProfitSummary(
  supabase: SupabaseClient
): Promise<BusinessProfitSummary> {
  const gross = await calculateGrossBusinessProfit(supabase);
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
  };
}
