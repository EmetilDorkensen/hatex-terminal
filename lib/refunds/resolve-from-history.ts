import type { SupabaseClient } from '@supabase/supabase-js';

export type ResolvedRefund = {
  source: 'reservation' | 'subscription' | 'invoice' | 'plugin' | 'payment_request';
  source_id: string;
};

function asMeta(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function extractOrderId(description: string | null | undefined): string | null {
  const m = String(description || '').match(/Kòmand\s*#\s*([^\s)]+)/i);
  if (!m?.[1] || m[1] === 'N/A') return null;
  return m[1].trim();
}

/**
 * Resolve sous ranbousman nan yon tranzaksyon kote machann nan te resevwa kob.
 * Pa fè konfyans navigatè — tout verifye sou sèvè.
 */
export async function resolveRefundFromHistoryTx(
  admin: SupabaseClient,
  merchantId: string,
  historyTxId: string
): Promise<{ ok: true; resolved: ResolvedRefund } | { ok: false; message: string }> {
  const { data: tx, error } = await admin
    .from('transactions')
    .select('id, user_id, amount, type, description, status, metadata, reference_id')
    .eq('id', historyTxId)
    .eq('user_id', merchantId)
    .maybeSingle();

  if (error || !tx) {
    return { ok: false, message: 'Tranzaksyon pa jwenn.' };
  }

  const meta = asMeta(tx.metadata);
  if (meta.refunded === true) {
    return { ok: false, message: 'Deja ranbouse.' };
  }

  // Mesaj « demann ranbousman » nan istorik machann
  if (tx.type === 'REFUND_REQUEST') {
    if (meta.source && meta.source_id) {
      return {
        ok: true,
        resolved: {
          source: meta.source as ResolvedRefund['source'],
          source_id: String(meta.source_id),
        },
      };
    }
    if (meta.merchant_credit_tx_id) {
      return resolveRefundFromHistoryTx(admin, merchantId, String(meta.merchant_credit_tx_id));
    }
    return { ok: false, message: 'Demann ranbousman pa konplè.' };
  }

  if (!(Number(tx.amount) > 0)) {
    return { ok: false, message: 'Sèlman resevwa (kob antre) yo ka ranbouse.' };
  }

  if (meta.booking_id && (tx.type === 'RESERVATION_RECEIPT' || meta.source === 'reservation')) {
    return {
      ok: true,
      resolved: { source: 'reservation', source_id: String(meta.booking_id) },
    };
  }
  if (meta.subscription_id) {
    return {
      ok: true,
      resolved: { source: 'subscription', source_id: String(meta.subscription_id) },
    };
  }
  if (meta.invoice_id || meta.source === 'invoice') {
    if (!meta.invoice_id) {
      return { ok: false, message: 'ID fakti manke nan tranzaksyon an.' };
    }
    return {
      ok: true,
      resolved: { source: 'invoice', source_id: String(meta.invoice_id) },
    };
  }
  if (meta.payment_request_id) {
    return {
      ok: true,
      resolved: { source: 'payment_request', source_id: String(meta.payment_request_id) },
    };
  }
  if (meta.plugin_tx_id) {
    return {
      ok: true,
      resolved: { source: 'plugin', source_id: String(meta.plugin_tx_id) },
    };
  }

  const orderId = extractOrderId(tx.description);

  if (orderId && (tx.type === 'SALE' || tx.type === 'SALE_SDK' || meta.source === 'public_api')) {
    const { data: pluginTx } = await admin
      .from('plugin_transactions')
      .select('id, status')
      .eq('merchant_id', merchantId)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pluginTx?.id) {
      return { ok: true, resolved: { source: 'plugin', source_id: pluginTx.id } };
    }

    const { data: payReq } = await admin
      .from('payment_requests')
      .select('id, status')
      .eq('merchant_id', merchantId)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (payReq?.id) {
      return {
        ok: true,
        resolved: { source: 'payment_request', source_id: payReq.id },
      };
    }
  }

  if (tx.type === 'MERCHANT_RECEIPT' && orderId) {
    const { data: payReq } = await admin
      .from('payment_requests')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (payReq?.id) {
      return {
        ok: true,
        resolved: { source: 'payment_request', source_id: payReq.id },
      };
    }
  }

  // Match by reference_id prefix on plugin_transactions.transaction_id / hatex ref
  const ref = String(tx.reference_id || '').replace(/-M$/i, '');
  if (ref && (tx.type === 'SALE' || tx.type === 'SALE_SDK')) {
    const { data: byRef } = await admin
      .from('plugin_transactions')
      .select('id')
      .eq('merchant_id', merchantId)
      .or(`transaction_id.eq.${ref},id.eq.${ref}`)
      .limit(1)
      .maybeSingle();
    if (byRef?.id) {
      return { ok: true, resolved: { source: 'plugin', source_id: byRef.id } };
    }
  }

  return {
    ok: false,
    message: 'Pa ka idantifye sous ranbousman pou mesaj sa a. Eseye nan Terminal → Rezèvasyon / Fakti.',
  };
}

/** Make metadata stamp after successful refund so bouton disparèt nan istorik. */
export async function stampHistoryTxRefunded(
  admin: SupabaseClient,
  merchantId: string,
  historyTxId: string,
  extra?: Record<string, unknown>
) {
  const { data: tx } = await admin
    .from('transactions')
    .select('metadata, type')
    .eq('id', historyTxId)
    .eq('user_id', merchantId)
    .maybeSingle();
  if (!tx) return;

  const meta = asMeta(tx.metadata);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    metadata: {
      ...meta,
      refunded: true,
      refunded_at: now,
      ...extra,
    },
  };
  if (tx.type === 'REFUND_REQUEST') patch.status = 'success';

  await admin
    .from('transactions')
    .update(patch)
    .eq('id', historyTxId)
    .eq('user_id', merchantId);

  // Si se te yon demann kliyan: make request + credit/buyer txs kòm ranbouse
  if (tx.type === 'REFUND_REQUEST') {
    await stampRefundRequestFulfilled(admin, merchantId, historyTxId, meta);
  }
}

async function stampRefundRequestFulfilled(
  admin: SupabaseClient,
  merchantId: string,
  noticeTxId: string,
  meta: Record<string, unknown>
) {
  const now = new Date().toISOString();
  const source = meta.source ? String(meta.source) : null;
  const sourceId = meta.source_id ? String(meta.source_id) : null;

  await admin
    .from('hatex_refund_requests')
    .update({ status: 'refunded', updated_at: now })
    .eq('merchant_id', merchantId)
    .eq('merchant_notice_tx_id', noticeTxId);

  if (source && sourceId) {
    await admin
      .from('hatex_refund_requests')
      .update({ status: 'refunded', updated_at: now })
      .eq('merchant_id', merchantId)
      .eq('source', source)
      .eq('source_id', sourceId)
      .eq('status', 'pending');
  }

  const creditTxId = meta.merchant_credit_tx_id ? String(meta.merchant_credit_tx_id) : null;
  if (creditTxId && creditTxId !== noticeTxId) {
    const { data: creditTx } = await admin
      .from('transactions')
      .select('metadata')
      .eq('id', creditTxId)
      .eq('user_id', merchantId)
      .maybeSingle();
    if (creditTx) {
      await admin
        .from('transactions')
        .update({
          metadata: {
            ...asMeta(creditTx.metadata),
            refunded: true,
            refunded_at: now,
            refund_source: source,
            refund_source_id: sourceId,
          },
        })
        .eq('id', creditTxId)
        .eq('user_id', merchantId);
    }
  }

  const buyerTxId = meta.buyer_tx_id ? String(meta.buyer_tx_id) : null;
  const buyerId = meta.buyer_id ? String(meta.buyer_id) : null;
  if (buyerTxId && buyerId) {
    const { data: buyerTx } = await admin
      .from('transactions')
      .select('metadata')
      .eq('id', buyerTxId)
      .eq('user_id', buyerId)
      .maybeSingle();
    if (buyerTx) {
      await admin
        .from('transactions')
        .update({
          metadata: {
            ...asMeta(buyerTx.metadata),
            refunded: true,
            refunded_at: now,
            refund_requested: true,
          },
        })
        .eq('id', buyerTxId)
        .eq('user_id', buyerId);
    }
  }
}
