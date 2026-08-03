/** Helper pou konnen si yon tranzaksyon (kote machann resevwa) ka gen bouton ranbousman. */

export type RefundableTx = {
  id?: string;
  amount?: number | string;
  type?: string;
  status?: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

const MERCHANT_CREDIT_TYPES = new Set([
  'RESERVATION_RECEIPT',
  'SALE',
  'SALE_SDK',
  'MERCHANT_RECEIPT',
  'REFUND_REQUEST',
]);

export function isHistoryRefundable(t: RefundableTx): boolean {
  const type = String(t.type || '');
  if (type === 'REFUND_REQUEST') {
    return t.metadata?.refunded !== true;
  }

  const amount = Number(t.amount || 0);
  if (!(amount > 0)) return false;
  if (t.metadata?.refunded === true) return false;
  if (t.type === 'REFUND_OUT' || t.type === 'REFUND_IN') return false;

  const status = String(t.status || '').toLowerCase();
  if (status && !['success', 'paid', 'completed', 'approved', 'pending'].includes(status)) {
    return false;
  }

  if (!MERCHANT_CREDIT_TYPES.has(type)) return false;

  const meta = t.metadata || {};

  if (type === 'RESERVATION_RECEIPT') return true;
  if (meta.booking_id || meta.subscription_id) return true;
  if (meta.invoice_id || meta.source === 'invoice') return true;
  if (meta.payment_request_id) return true;
  if (meta.plugin_tx_id || meta.source === 'plugin') return true;
  if (meta.source === 'public_api') return true;
  if (type === 'SALE_SDK' || type === 'MERCHANT_RECEIPT') return true;
  if (type === 'SALE') return true;

  return false;
}

export function isInvoiceRefundable(inv: {
  id?: string;
  status?: string;
  amount?: number | string;
}): boolean {
  if (!inv?.id) return false;
  if (String(inv.status || '').toLowerCase() !== 'paid') return false;
  return Number(inv.amount || 0) > 0;
}
