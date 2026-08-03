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
  if (!(Number(tx.amount) > 0)) {
    return { ok: false, message: 'Sèlman resevwa (kob antre) yo ka ranbouse.' };
  }

  const meta = asMeta(tx.metadata);
  if (meta.refunded === true) {
    return { ok: false, message: 'Deja ranbouse.' };
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
    .select('metadata')
    .eq('id', historyTxId)
    .eq('user_id', merchantId)
    .maybeSingle();
  if (!tx) return;

  const meta = asMeta(tx.metadata);
  await admin
    .from('transactions')
    .update({
      metadata: {
        ...meta,
        refunded: true,
        refunded_at: new Date().toISOString(),
        ...extra,
      },
    })
    .eq('id', historyTxId)
    .eq('user_id', merchantId);
}
