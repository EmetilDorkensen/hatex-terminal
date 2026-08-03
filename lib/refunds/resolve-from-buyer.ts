import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResolvedRefund } from '@/lib/refunds/resolve-from-history';

function asMeta(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

export type BuyerRefundResolve = ResolvedRefund & {
  merchant_id: string;
  merchant_tx_id: string | null;
  amount: number;
  title: string;
};

/**
 * Resolve sous ranbousman nan yon tranzaksyon DEBIT kliyan (amount < 0).
 */
export async function resolveRefundFromBuyerTx(
  admin: SupabaseClient,
  buyerId: string,
  buyerTxId: string
): Promise<{ ok: true; resolved: BuyerRefundResolve } | { ok: false; message: string }> {
  const { data: tx, error } = await admin
    .from('transactions')
    .select('id, user_id, amount, type, description, status, metadata, reference_id')
    .eq('id', buyerTxId)
    .eq('user_id', buyerId)
    .maybeSingle();

  if (error || !tx) {
    return { ok: false, message: 'Tranzaksyon pa jwenn.' };
  }
  if (!(Number(tx.amount) < 0)) {
    return { ok: false, message: 'Sèlman peman (kob soti) yo ka mande ranbousman.' };
  }

  const meta = asMeta(tx.metadata);
  if (meta.refunded === true) {
    return { ok: false, message: 'Deja ranbouse.' };
  }
  if (meta.refund_requested === true) {
    return { ok: false, message: 'Ou deja mande ranbousman pou sa a.' };
  }

  const amount = Math.abs(Number(tx.amount));
  const title = String(tx.description || 'Sèvis').slice(0, 200);

  // Reservation / abònman
  if (
    (tx.type === 'RESERVATION_PAYMENT' || meta.source === 'reservation') &&
    meta.booking_id
  ) {
    const { data: booking } = await admin
      .from('reservation_bookings')
      .select('id, merchant_id, merchant_tx_id, status, amount')
      .eq('id', String(meta.booking_id))
      .maybeSingle();
    if (!booking || booking.status !== 'paid') {
      return { ok: false, message: 'Rezèvasyon sa a pa ka mande ranbousman.' };
    }
    return {
      ok: true,
      resolved: {
        source: 'reservation',
        source_id: booking.id,
        merchant_id: booking.merchant_id,
        merchant_tx_id: booking.merchant_tx_id || null,
        amount: Number(booking.amount || amount),
        title,
      },
    };
  }

  if (meta.subscription_id) {
    const { data: sub } = await admin
      .from('reservation_subscriptions')
      .select('id, merchant_id, last_booking_id, amount, status')
      .eq('id', String(meta.subscription_id))
      .maybeSingle();
    if (!sub) return { ok: false, message: 'Abònman pa jwenn.' };
    let merchantTx: string | null = null;
    if (sub.last_booking_id) {
      const { data: b } = await admin
        .from('reservation_bookings')
        .select('merchant_tx_id, status')
        .eq('id', sub.last_booking_id)
        .maybeSingle();
      if (b?.status === 'paid') merchantTx = b.merchant_tx_id || null;
    }
    return {
      ok: true,
      resolved: {
        source: 'subscription',
        source_id: sub.id,
        merchant_id: sub.merchant_id,
        merchant_tx_id: merchantTx,
        amount: Number(sub.amount || amount),
        title,
      },
    };
  }

  // Invoice
  if (meta.invoice_id || meta.source === 'invoice') {
    const invoiceId = String(meta.invoice_id || '');
    if (!invoiceId) return { ok: false, message: 'ID fakti manke.' };
    const { data: inv } = await admin
      .from('invoices')
      .select('id, owner_id, amount, status, description')
      .eq('id', invoiceId)
      .maybeSingle();
    if (!inv || inv.status !== 'paid') {
      return { ok: false, message: 'Fakti sa a pa ka mande ranbousman.' };
    }
    const { data: sale } = await admin
      .from('transactions')
      .select('id')
      .eq('user_id', inv.owner_id)
      .eq('type', 'SALE')
      .contains('metadata', { invoice_id: invoiceId })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      ok: true,
      resolved: {
        source: 'invoice',
        source_id: inv.id,
        merchant_id: inv.owner_id,
        merchant_tx_id: sale?.id || null,
        amount: Number(inv.amount || amount),
        title: inv.description || title,
      },
    };
  }

  if (meta.payment_request_id) {
    const { data: pay } = await admin
      .from('payment_requests')
      .select('id, merchant_id, amount, status')
      .eq('id', String(meta.payment_request_id))
      .maybeSingle();
    if (!pay) return { ok: false, message: 'Peman pa jwenn.' };
    return {
      ok: true,
      resolved: {
        source: 'payment_request',
        source_id: pay.id,
        merchant_id: pay.merchant_id,
        merchant_tx_id: null,
        amount: Number(pay.amount || amount),
        title,
      },
    };
  }

  // Pair merchant credit by reference_id (…-C → …-M)
  const ref = String(tx.reference_id || '');
  if (ref) {
    const merchantRef = ref.replace(/-C$/i, '-M');
    if (merchantRef !== ref) {
      const { data: mTx } = await admin
        .from('transactions')
        .select('id, user_id, amount, type, metadata')
        .eq('reference_id', merchantRef)
        .gt('amount', 0)
        .maybeSingle();
      if (mTx) {
        const mMeta = asMeta(mTx.metadata);
        let source: ResolvedRefund['source'] | null = null;
        let sourceId: string | null = null;
        if (mMeta.booking_id) {
          source = 'reservation';
          sourceId = String(mMeta.booking_id);
        } else if (mMeta.invoice_id) {
          source = 'invoice';
          sourceId = String(mMeta.invoice_id);
        } else if (mMeta.payment_request_id) {
          source = 'payment_request';
          sourceId = String(mMeta.payment_request_id);
        } else if (mMeta.plugin_tx_id) {
          source = 'plugin';
          sourceId = String(mMeta.plugin_tx_id);
        } else if (mMeta.source === 'public_api') {
          // try plugin by order later via merchant path — use payment_request if possible
        }
        if (source && sourceId) {
          return {
            ok: true,
            resolved: {
              source,
              source_id: sourceId,
              merchant_id: mTx.user_id,
              merchant_tx_id: mTx.id,
              amount: Number(mTx.amount || amount),
              title,
            },
          };
        }
        // At least we have merchant - for SALE public_api try plugin resolve on merchant side via order
        if (mTx.type === 'SALE' || mTx.type === 'SALE_SDK' || mTx.type === 'MERCHANT_RECEIPT') {
          return {
            ok: false,
            message:
              'Pa ka idantifye sous ranbousman otomatikman. Kontakte machann nan oswa sipò.',
          };
        }
      }
    }
  }

  if (['PAYMENT', 'PURCHASE', 'RESERVATION_PAYMENT', 'SUBSCRIPTION'].includes(tx.type)) {
    return {
      ok: false,
      message: 'Pa ka idantifye sèvis sa a pou ranbousman. Kontakte sipò.',
    };
  }

  return { ok: false, message: 'Tranzaksyon sa a pa ka mande ranbousman.' };
}

export function isClientRefundRequestable(t: {
  amount?: number | string;
  type?: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const amount = Number(t.amount || 0);
  if (!(amount < 0)) return false;
  if (t.metadata?.refunded === true) return false;
  if (t.metadata?.refund_requested === true) return false;
  if (t.type === 'REFUND_OUT' || t.type === 'REFUND_IN' || t.type === 'REFUND_REQUEST') return false;
  const status = String(t.status || '').toLowerCase();
  if (status && !['success', 'paid', 'completed', 'approved'].includes(status)) return false;

  const type = String(t.type || '');
  const meta = t.metadata || {};
  if (type === 'RESERVATION_PAYMENT') return true;
  if (type === 'PAYMENT' && (meta.invoice_id || meta.source === 'invoice')) return true;
  if (type === 'PURCHASE' && (meta.source === 'public_api' || meta.payment_request_id)) return true;
  if (type === 'SUBSCRIPTION' || meta.is_subscription) return true;
  if (meta.booking_id || meta.invoice_id || meta.payment_request_id) return true;
  return false;
}
