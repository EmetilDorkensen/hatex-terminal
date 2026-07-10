/** Prepare transactions for user-facing history (hide fee rows, merge into P2P). */

export type UserTransaction = {
  id: string;
  user_id: string;
  amount: number | string;
  type: string;
  description?: string | null;
  created_at: string;
  user_email?: string | null;
  metadata?: Record<string, unknown> | null;
  _pairedFee?: number;
  [key: string]: unknown;
};

function isHiddenTransferFee(t: UserTransaction): boolean {
  if (t.type === 'TRANSFER_FEE' || t.type === 'API_FEE') return true;
  const desc = String(t.description || '').toLowerCase();
  if (desc.includes('frè transfè') || desc.includes('frè transfe')) return true;
  if (t.metadata?.hidden_from_user === true) return true;
  return false;
}

export function prepareUserTransactions<T extends UserTransaction>(transactions: T[]): T[] {
  const feeWindowMs = 5000;
  const fees: Array<{ userId: string; at: number; amount: number }> = [];

  for (const t of transactions) {
    if (isHiddenTransferFee(t)) {
      fees.push({
        userId: String(t.user_id),
        at: new Date(t.created_at).getTime(),
        amount: Math.abs(Number(t.amount || 0)),
      });
    }
  }

  const findPairedFee = (t: UserTransaction) => {
    if (Number(t.amount) >= 0) return 0;
    const metaFee = Number(t.metadata?.transfer_fee || 0);
    if (metaFee > 0) return metaFee;

    const at = new Date(t.created_at).getTime();
    const match = fees.find(
      (f) => f.userId === String(t.user_id) && Math.abs(f.at - at) <= feeWindowMs
    );
    return match?.amount || 0;
  };

  return transactions
    .filter((t) => !isHiddenTransferFee(t))
    .map((t) => {
      if (t.type === 'P2P' && Number(t.amount) < 0) {
        return { ...t, _pairedFee: findPairedFee(t) };
      }
      return t;
    });
}

export function getTransactionDescription(t: UserTransaction): string {
  if (t.type === 'SUBSCRIPTION' || t.metadata?.is_subscription) {
    const planName = String(t.metadata?.plan_name || 'PLAN');
    const merchantName = String(t.metadata?.merchant_name || 'BIZNIS');
    return `ABÒNMAN ${planName.toUpperCase()} - ${merchantName.toUpperCase()}`;
  }
  if (t.type === 'SALE') {
    return `VANT BAY ${String(t.metadata?.customer_name || 'KLIYAN')}`;
  }
  if (t.type === 'PAYMENT') {
    const businessName = String(t.metadata?.merchant_name || 'BIZNIS');
    return `ACHA NAN ${businessName.toUpperCase()}`;
  }
  if (t.type === 'P2P' && Number(t.amount) < 0) {
    const base = String(t.description || 'TRANSFÈ BAY')
      .replace(/\s*@\S+/g, '')
      .replace(/bay\s+[^\s]+@[^\s]+/gi, '')
      .trim();
    const fee = Number(t._pairedFee || t.metadata?.transfer_fee || 0);
    if (fee > 0) {
      return `${base} (+ ${fee.toLocaleString()} HTG frè)`;
    }
    return base;
  }
  return String(t.description || t.type);
}
