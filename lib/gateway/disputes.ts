import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// LITIJ MACHANN — lojik pataje ant wout /api/dispute ak /api/client/dispute
// ============================================================================
// Spec §5:
//   • Yon achtè ka ouvri yon rapò (dispute) sou yon lòd peye.
//   • Apre 3 rapò ouvè sou menm machann, sistèm nan sispann kont lan
//     otomatikman epi li dezaktive tout kle API l yo.
//
// Sistèm nan pa kenbe lajan (pasrèl) — yon litij se yon siyal pou revizyon
// imen ak pwoteksyon kont abi.
// ============================================================================

export const FRAUD_DISPUTE_LIMIT = 3;

export type DisputeAuthUser = {
  id: string;
  email?: string | null;
};

export type FileDisputeInput = {
  orderId: string;
  reason: string;
  proofText?: string | null;
  storeName?: string | null;
};

type PluginTxRow = {
  id: string;
  merchant_id: string;
  order_id: string;
  status?: string | null;
  customer_info?: Record<string, unknown> | null;
};

type HatexPaymentRow = {
  id: string;
  merchant_id: string;
  merchant_order_id: string | null;
  gateway_order_id: string | null;
  status?: string | null;
  payer_phone?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ResolvedTarget = {
  sourceTable: 'plugin_transactions' | 'hatex_payments';
  sourceId: string;
  orderId: string;
  merchantId: string;
  rowStatus: string | null;
};

export type FileDisputeResult =
  | {
      ok: true;
      code: 'filed' | 'already_filed';
      disputeId: string | null;
      merchantSuspended: boolean;
      message: string;
    }
  | { ok: false; status: number; code: string; message: string };

/** Netwaye yon nimewo telefòn pou konparezon (509XXXXXXXX oswa XXXXXXXXX). */
function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('509')) return digits.slice(3);
  return digits.length >= 8 ? digits : null;
}

function lower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Chèche yon adrès imèl nan plizyè plas (jsonb metadata/customer_info). */
function findEmailIn(obj: Record<string, unknown> | null | undefined): string {
  if (!obj) return '';
  for (const key of ['customer_email', 'customerEmail', 'email', 'client_email', 'payer_email']) {
    const v = lower(obj[key]);
    if (v.includes('@')) return v;
  }
  if (obj.customer && typeof obj.customer === 'object' && obj.customer !== null) {
    const nested = findEmailIn(obj.customer as Record<string, unknown>);
    if (nested) return nested;
  }
  return '';
}

/** Rekipere lòd la nan plugin_transactions oswa hatex_payments (gateway v2). */
async function resolveDisputeTarget(
  admin: SupabaseClient,
  cleanOrderId: string
): Promise<ResolvedTarget | null> {
  // 1. Plugin / checkout ansyen
  const plugin = await admin
    .from('plugin_transactions')
    .select('id, merchant_id, order_id, status, customer_info')
    .eq('order_id', cleanOrderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const pRow = plugin.data as PluginTxRow | null;
  if (pRow) {
    return {
      sourceTable: 'plugin_transactions',
      sourceId: pRow.id,
      orderId: pRow.order_id,
      merchantId: pRow.merchant_id,
      rowStatus: pRow.status ?? null,
    };
  }

  // 2. Gateway v2 (hatex_payments) — referans machann oswa referans HatexCard
  const byMerchantOrder = await admin
    .from('hatex_payments')
    .select('id, merchant_id, merchant_order_id, gateway_order_id, status, payer_phone, metadata')
    .eq('merchant_order_id', cleanOrderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let gRow = byMerchantOrder.data as HatexPaymentRow | null;

  if (!gRow) {
    const byGateway = await admin
      .from('hatex_payments')
      .select('id, merchant_id, merchant_order_id, gateway_order_id, status, payer_phone, metadata')
      .eq('gateway_order_id', cleanOrderId)
      .maybeSingle();
    gRow = byGateway.data as HatexPaymentRow | null;
  }

  if (gRow) {
    return {
      sourceTable: 'hatex_payments',
      sourceId: gRow.id,
      orderId: gRow.merchant_order_id || gRow.gateway_order_id || cleanOrderId,
      merchantId: gRow.merchant_id,
      rowStatus: gRow.status ?? null,
    };
  }

  return null;
}

/**
 * Kè senp pou ouvri yon litij. Tcheke posesyon, anrejistre rapò a, epi
 * deklannche sispansyon otomatik si machann nan rive sou 3 rapò ouvè.
 */
export async function fileMerchantDispute(
  admin: SupabaseClient,
  user: DisputeAuthUser,
  input: FileDisputeInput
): Promise<FileDisputeResult> {
  const reason = input.reason.trim().slice(0, 1000);
  if (!input.orderId || !reason) {
    return {
      ok: false,
      status: 400,
      code: 'missing_fields',
      message: 'ID kòmand la ak rezon an obligatwa.',
    };
  }

  const cleanOrderId = input.orderId.toString().replace('#', '').trim();
  if (!cleanOrderId) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_order_id',
      message: 'ID kòmand la pa valab.',
    };
  }

  const target = await resolveDisputeTarget(admin, cleanOrderId);
  if (!target) {
    return {
      ok: false,
      status: 404,
      code: 'order_not_found',
      message: 'Nou pa jwenn kòmand sa a nan sistèm nan. Tcheke ID a byen.',
    };
  }

  // ---- Verifikasyon estati -----------------------------------------------
  if (target.sourceTable === 'plugin_transactions') {
    const blocked: Record<string, string> = {
      pending: 'Kòmand sa a poko peye.',
      failed: 'Kòmand sa a echwe. Pa gen anyen pou diskite.',
      expired: 'Kòmand sa a ekspire.',
      cancelled: 'Kòmand sa a anile.',
      refunded: 'Lajan kòmand sa a te gentan ranbouse deja.',
      delivered: 'Twò ta! Ou te gentan bay kòd la epi machann nan touche kòb la deja. Kontakte Sipò.',
    };
    const reasonBlock = target.rowStatus ? blocked[target.rowStatus] : undefined;
    if (target.rowStatus === 'disputed') {
      return {
        ok: false,
        status: 400,
        code: 'already_filed',
        message: 'Kòmand sa a gen yon litij sou li deja.',
      };
    }
    if (reasonBlock) {
      return { ok: false, status: 400, code: 'status_not_allowed', message: reasonBlock };
    }
  } else if (target.sourceTable === 'hatex_payments') {
    if (target.rowStatus !== 'paid') {
      return {
        ok: false,
        status: 400,
        code: 'payment_not_paid',
        message:
          target.rowStatus === 'pending'
            ? 'Kòmand sa a poko fin peye. Ret tann konfimasyon an.'
            : 'Ou ka ouvri yon litij sèlman sou yon peman ki reyisi.',
      };
    }
  }

  // ---- Verifikasyon posesyon ---------------------------------------------
  const { data: profile } = await admin
    .from('profiles')
    .select('email, phone')
    .eq('id', user.id)
    .maybeSingle();

  const profileEmail = lower(user.email || profile?.email);
  const profilePhone = normalizePhone(profile?.phone);

  let isOwner = false;

  if (target.sourceTable === 'plugin_transactions') {
    const { data: tx } = await admin
      .from('plugin_transactions')
      .select('customer_info')
      .eq('id', target.sourceId)
      .maybeSingle();
    const customer = ((tx?.customer_info as Record<string, unknown> | null) || {}) as Record<
      string,
      unknown
    >;
    const customerEmail = lower(customer.email);
    const customerPhone = normalizePhone(customer.phone);
    isOwner =
      (!!profileEmail && customerEmail === profileEmail) ||
      (!!profilePhone && customerPhone === profilePhone);
  } else {
    const { data: tx } = await admin
      .from('hatex_payments')
      .select('payer_phone, metadata')
      .eq('id', target.sourceId)
      .maybeSingle();
    const meta = ((tx?.metadata as Record<string, unknown> | null) || {}) as Record<
      string,
      unknown
    >;
    const payerEmail = findEmailIn(meta);
    const payerPhone = normalizePhone(tx?.payer_phone);
    isOwner =
      (!!profileEmail && !!payerEmail && payerEmail === profileEmail) ||
      (!!profilePhone && !!payerPhone && payerPhone === profilePhone);
  }

  if (!isOwner) {
    return {
      ok: false,
      status: 403,
      code: 'not_owner',
      message: 'Kòmand sa a pa asosye ak kont ou. Ou pa ka ouvè yon litij sou li.',
    };
  }

  // ---- Pa double-litij -----------------------------------------------
  const { data: existingDispute } = await admin
    .from('hatex_merchant_disputes')
    .select('id')
    .eq('source_table', target.sourceTable)
    .eq('source_id', target.sourceId)
    .maybeSingle();

  if (existingDispute) {
    return {
      ok: false,
      status: 400,
      code: 'already_filed',
      message: 'Kòmand sa a gen yon litij sou li deja.',
    };
  }

  const now = new Date().toISOString();

  // ---- Anrejistre litij la -----------------------------------------------
  const { data: inserted, error: insertErr } = await admin
    .from('hatex_merchant_disputes')
    .insert({
      merchant_id: target.merchantId,
      client_id: user.id,
      source_table: target.sourceTable,
      source_id: target.sourceId,
      order_id: target.orderId,
      client_phone: profile?.phone || null,
      client_email: profile?.email || user.email || null,
      reason,
      proof_text: input.proofText?.trim().slice(0, 2000) || null,
      store_name: input.storeName?.trim().slice(0, 120) || null,
      status: 'open',
      created_at: now,
    })
    .select('id')
    .single();

  if (insertErr) {
    if (/duplicate|unique/i.test(insertErr.message)) {
      return {
        ok: false,
        status: 400,
        code: 'already_filed',
        message: 'Kòmand sa a gen yon litij sou li deja.',
      };
    }
    console.error('[disputes] Insert echwe:', insertErr.message);
    return {
      ok: false,
      status: 500,
      code: 'storage_error',
      message: 'Pa t kapab anrejistre litij la. Eseye ankò.',
    };
  }

  // ---- Make plugin_transactions 'disputed' (konpatibilite ansyen UI) ----
  if (target.sourceTable === 'plugin_transactions') {
    await admin
      .from('plugin_transactions')
      .update({
        status: 'disputed',
        dispute_reason: reason,
        dispute_details: {
          client_id: user.id,
          client_email: profile?.email || user.email || null,
          proof_text: input.proofText?.trim().slice(0, 2000) || reason,
          filed_at: now,
        },
      })
      .eq('id', target.sourceId);
  }

  // ---- Sispansyon otomatik (3+ rapò ouvè) -------------------------------
  let merchantSuspended = false;
  const { data: suspended, error: rpcErr } = await admin.rpc('hx_auto_suspend_fraud_merchant', {
    p_merchant: target.merchantId,
  });
  merchantSuspended = !rpcErr && suspended === true;
  if (rpcErr) {
    console.error('[disputes] Auto-suspend RPC echwe:', rpcErr.message);
  }

  const baseMessage = merchantSuspended
    ? 'Litij la anrejistre. Machann nan rive sou plizyè rapò: kont li sispann otomatikman epi kle API l yo dezaktive pandan revizyon an.'
    : 'Plent lan anrejistre avèk siksè! Ekip HatexCard ap revize litij la epi machann nan ap notifye.';

  return {
    ok: true,
    code: 'filed',
    disputeId: inserted?.id ?? null,
    merchantSuspended,
    message: baseMessage,
  };
}

export type MerchantDisputeRow = {
  id: string;
  order_id: string;
  reason: string;
  proof_text: string | null;
  status: string;
  created_at: string;
  source_table: string;
  client_email: string | null;
};

/** Lis litij yon machann genyen (sèlman li nan panèl machann). */
export async function listMerchantDisputes(
  admin: SupabaseClient,
  merchantId: string,
  onlyOpen = true
): Promise<MerchantDisputeRow[]> {
  let query = admin
    .from('hatex_merchant_disputes')
    .select('id, order_id, reason, proof_text, status, created_at, source_table, client_email')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (onlyOpen) query = query.eq('status', 'open');

  const { data, error } = await query;
  if (error) {
    console.error('[disputes] Lis litij echwe:', error.message);
    return [];
  }
  return (data || []) as MerchantDisputeRow[];
}

/** Konte litij ouvè yon machann genyen (menm definisyon ak fonksyon SQL la). */
export async function countOpenMerchantDisputes(
  admin: SupabaseClient,
  merchantId: string
): Promise<number> {
  const { count, error } = await admin
    .from('hatex_merchant_disputes')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('status', 'open');
  if (error) return 0;
  return count ?? 0;
}

