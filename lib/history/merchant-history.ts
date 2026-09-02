import type { SupabaseClient } from '@supabase/supabase-js';

export type HistoryRow = {
  id: string;
  type: 'PAYMENT' | 'SALE' | 'SUBSCRIPTION' | 'PAYOUT' | 'KYC_FEE' | 'PLAN_FEE';
  amount: number;
  status: string;
  description: string;
  order_id: string | null;
  purpose: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

function paymentType(purpose: string, merchantId: string, rowMerchantId: string): HistoryRow['type'] {
  if (purpose === 'plan_fee') return 'PLAN_FEE';
  if (purpose === 'kyc_fee') return 'KYC_FEE';
  if (purpose === 'merchant' || purpose === 'invoice') {
    return rowMerchantId === merchantId ? 'SALE' : 'PAYMENT';
  }
  return 'PAYMENT';
}

function payoutDescription(
  paid: boolean,
  receiverPhone: string | null,
  walletFull: boolean | null,
  lastError: string | null
): string {
  if (paid) {
    return `Depo sou MonCash${receiverPhone ? ` · ${receiverPhone}` : ''}`;
  }
  if (walletFull) return 'Depo an atant — kont MonCash plen';
  if (lastError) return `Depo echwe: ${lastError}`;
  return 'Depo sou MonCash an atant';
}

function paymentAmount(purpose: string, merchantAmount: number, clientTotal: number, platformFee: number): number {
  if (purpose === 'plan_fee' || purpose === 'kyc_fee') {
    return -Number(clientTotal || platformFee || 0);
  }
  if (purpose === 'merchant' || purpose === 'invoice') {
    return Number(merchantAmount || 0);
  }
  return -Number(clientTotal || 0);
}

function paymentDescription(
  purpose: string,
  description: string | null,
  merchantOrderId: string | null
): string {
  if (description?.trim()) return description.trim();
  if (purpose === 'plan_fee') return 'Abonnman HatexCard';
  if (purpose === 'kyc_fee') return 'Frè verifikasyon KYC';
  if (merchantOrderId) return `Peman ${merchantOrderId}`;
  return 'Peman MonCash';
}

function subscriptionDescription(plan: string): string {
  return plan === 'premium' ? 'Abonnman Premyòm HatexCard' : 'Abonnman Kapasite HatexCard';
}

/** Fusione hatex_payments, hatex_payouts, hatex_plan_subscriptions pou istorik machann. */
export async function fetchMerchantHistory(
  admin: SupabaseClient,
  merchantId: string,
  limit = 80
): Promise<HistoryRow[]> {
  const [paymentsRes, payoutsRes, subsRes] = await Promise.all([
    admin
      .from('hatex_payments')
      .select(
        'id, merchant_id, purpose, status, merchant_amount, client_total, platform_fee, description, merchant_order_id, metadata, created_at, paid_at'
      )
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(limit),
    admin
      .from('hatex_payouts')
      .select('id, amount, status, receiver_phone, last_error, wallet_full, created_at, paid_at')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(limit),
    admin
      .from('hatex_plan_subscriptions')
      .select('id, plan, status, amount_htg, current_period_start, current_period_end, created_at')
      .eq('user_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const rows: HistoryRow[] = [];

  for (const p of paymentsRes.data || []) {
    const purpose = String(p.purpose || 'merchant');
    const amount = paymentAmount(
      purpose,
      Number(p.merchant_amount || 0),
      Number(p.client_total || 0),
      Number(p.platform_fee || 0)
    );

    rows.push({
      id: String(p.id),
      type: paymentType(purpose, merchantId, String(p.merchant_id)),
      amount,
      status: String(p.status || 'pending'),
      description: paymentDescription(purpose, p.description, p.merchant_order_id),
      order_id: p.merchant_order_id || null,
      purpose,
      created_at: String(p.paid_at || p.created_at),
      metadata: (p.metadata as Record<string, unknown>) || {},
    });
  }

  for (const po of payoutsRes.data || []) {
    const paid = po.status === 'paid';
    rows.push({
      id: `payout-${po.id}`,
      type: 'PAYOUT',
      amount: Number(po.amount || 0),
      status: paid ? 'success' : String(po.status || 'pending'),
      description: payoutDescription(
        paid,
        po.receiver_phone,
        po.wallet_full,
        po.last_error
      ),
      order_id: null,
      purpose: 'payout',
      created_at: String(po.paid_at || po.created_at),
      metadata: {
        receiver_phone: po.receiver_phone,
        wallet_full: po.wallet_full === true,
      },
    });
  }

  for (const s of subsRes.data || []) {
    rows.push({
      id: `sub-${s.id}`,
      type: 'SUBSCRIPTION',
      amount: -Number(s.amount_htg || 0),
      status: String(s.status || 'active'),
      description: subscriptionDescription(String(s.plan || '')),
      order_id: null,
      purpose: 'plan_fee',
      created_at: String(s.current_period_start || s.created_at),
      metadata: {
        is_subscription: true,
        plan: s.plan,
        period_end: s.current_period_end,
      },
    });
  }

  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return rows.slice(0, limit);
}

export function filterHistoryTab(rows: HistoryRow[], tab: string): HistoryRow[] {
  if (tab === 'PEMAN') {
    return rows.filter(
      (r) =>
        r.type === 'PAYMENT' ||
        r.type === 'SALE' ||
        r.type === 'KYC_FEE' ||
        r.type === 'PAYOUT' ||
        r.purpose === 'merchant' ||
        r.purpose === 'invoice'
    );
  }
  if (tab === 'ABÒNMAN') {
    return rows.filter((r) => r.type === 'SUBSCRIPTION' || r.type === 'PLAN_FEE');
  }
  return rows;
}
