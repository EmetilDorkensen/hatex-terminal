import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { requireMoneySession } from '@/lib/security/require-money-session';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { authenticateMerchantApiKey } from '@/lib/security/api-key';
import { isUntrustedBrowserRequest, merchantApiJson, parseBearerApiKey } from '@/lib/security/merchant-api';
import { sendRefundEmails } from '@/lib/reservations/notify-refund';
import {
  resolveRefundFromHistoryTx,
  stampHistoryTxRefunded,
} from '@/lib/refunds/resolve-from-history';

const SOURCES = new Set(['reservation', 'subscription', 'invoice', 'plugin', 'payment_request']);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Global refund API — tout verifye sou sèvè.
 * - Sesyon + MFA: Terminal / dashboard / istorik
 * - Bearer API key: plugin (konpatibilite ansyen)
 *
 * Body:
 * - { source, source_id } — dirèk
 * - { history_tx_id } — resolve nan tranzaksyon machann (istorik)
 * - { invoice_id } — fakti peye
 * - { transaction_id } — plugin tx (Bearer)
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`hatex-refund:${ip}`, 15, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp demann.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const reason = body.reason ? String(body.reason).slice(0, 500) : null;
  const historyTxId = body.history_tx_id ? String(body.history_tx_id).trim() : '';
  const invoiceIdOnly = body.invoice_id && !body.source ? String(body.invoice_id).trim() : '';

  const admin = createSupabaseAdminClient();
  let merchantId: string | null = null;

  const bearer = parseBearerApiKey(req);
  if (bearer) {
    if (isUntrustedBrowserRequest(req)) {
      return merchantApiJson({ success: false, message: 'API sa a se sèlman pou sèvè machann.' }, 403);
    }
    const merchant = await authenticateMerchantApiKey(admin, bearer);
    if (!merchant?.is_merchant) {
      return NextResponse.json({ success: false, message: 'Kle API pa valab.' }, { status: 403 });
    }
    if (merchant.account_status === 'suspended') {
      return NextResponse.json({ success: false, message: 'Kont sispann.' }, { status: 403 });
    }
    merchantId = merchant.id;
  } else {
    const auth = await requireMoneySession();
    if (!auth.ok) return auth.response;
    merchantId = auth.user.id;
  }

  if (!merchantId) {
    return NextResponse.json({ success: false, message: 'Machann pa idantifye.' }, { status: 401 });
  }

  let source = String(body.source || '').trim();
  let sourceId = String(body.source_id || '').trim();

  // Plugin API key path (ansyen): transaction_id = plugin_transactions.id
  if (!source && !historyTxId && !invoiceIdOnly && body.transaction_id) {
    source = 'plugin';
    sourceId = String(body.transaction_id).trim();
  }

  if (historyTxId) {
    if (!UUID_RE.test(historyTxId)) {
      return NextResponse.json({ success: false, message: 'ID tranzaksyon pa valab.' }, { status: 400 });
    }
    const resolved = await resolveRefundFromHistoryTx(admin, merchantId, historyTxId);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, message: resolved.message }, { status: 400 });
    }
    source = resolved.resolved.source;
    sourceId = resolved.resolved.source_id;
  } else if (invoiceIdOnly) {
    source = 'invoice';
    sourceId = invoiceIdOnly;
  }

  if (!SOURCES.has(source) || !sourceId) {
    return NextResponse.json(
      {
        success: false,
        message:
          'source + source_id, history_tx_id, oswa invoice_id obligatwa (transaction_id pou plugin).',
      },
      { status: 400 }
    );
  }

  if (!UUID_RE.test(sourceId)) {
    return NextResponse.json({ success: false, message: 'ID pa valab.' }, { status: 400 });
  }

  const { data: rpcRaw, error: rpcErr } = await admin.rpc('process_hatex_refund', {
    p_source: source,
    p_source_id: sourceId,
    p_merchant_id: merchantId,
    p_reason: reason,
  });

  if (rpcErr) {
    return NextResponse.json({ success: false, message: rpcErr.message || 'Ranbousman echwe.' }, { status: 400 });
  }

  const result =
    typeof rpcRaw === 'string' ? JSON.parse(rpcRaw) : (rpcRaw as Record<string, unknown> | null);

  if (!result?.success) {
    return NextResponse.json(
      { success: false, message: String(result?.message || 'Ranbousman echwe.') },
      { status: 400 }
    );
  }

  if (historyTxId) {
    try {
      await stampHistoryTxRefunded(admin, merchantId, historyTxId, {
        refund_source: source,
        refund_source_id: sourceId,
      });
    } catch {
      // pa kraze siksè RPC
    }
  } else if (source === 'invoice') {
    // Stamp SALE ki gen invoice_id nan metadata
    try {
      const { data: sales } = await admin
        .from('transactions')
        .select('id, metadata')
        .eq('user_id', merchantId)
        .eq('type', 'SALE')
        .contains('metadata', { invoice_id: sourceId });
      for (const s of sales || []) {
        await stampHistoryTxRefunded(admin, merchantId, s.id, {
          refund_source: source,
          refund_source_id: sourceId,
        });
      }
    } catch {
      // ignore
    }
  }

  // Fèmen demann kliyan pending + mesaj REFUND_REQUEST ki matche sous sa
  try {
    const now = new Date().toISOString();
    await admin
      .from('hatex_refund_requests')
      .update({ status: 'refunded', updated_at: now })
      .eq('merchant_id', merchantId)
      .eq('source', source)
      .eq('source_id', sourceId)
      .eq('status', 'pending');

    const { data: notices } = await admin
      .from('transactions')
      .select('id, metadata')
      .eq('user_id', merchantId)
      .eq('type', 'REFUND_REQUEST')
      .contains('metadata', { source, source_id: sourceId });

    for (const n of notices || []) {
      const meta =
        n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata)
          ? (n.metadata as Record<string, unknown>)
          : {};
      if (meta.refunded === true) continue;
      await stampHistoryTxRefunded(admin, merchantId, n.id, {
        refund_source: source,
        refund_source_id: sourceId,
      });
    }
  } catch {
    // pa kraze siksè RPC
  }

  try {
    const [{ data: merchantProf }, buyerEmail] = await Promise.all([
      admin
        .from('profiles')
        .select('email, full_name, business_name')
        .eq('id', merchantId)
        .maybeSingle(),
      Promise.resolve(result.buyer_email as string | null | undefined),
    ]);

    let buyerName: string | null = null;
    if (result.buyer_id) {
      const { data: b } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', String(result.buyer_id))
        .maybeSingle();
      buyerName = b?.full_name || null;
    }

    await sendRefundEmails({
      buyerEmail: buyerEmail || null,
      merchantEmail: merchantProf?.email,
      merchantName: merchantProf?.business_name || merchantProf?.full_name,
      buyerName,
      amount: Number(result.refunded || 0),
      title: String(result.title || 'Ranbousman'),
      reason,
    });
  } catch {
    // pa kraze siksè RPC
  }

  return NextResponse.json({
    success: true,
    message: result.message || 'Ranbousman an pase.',
    refunded: result.refunded,
    reference_id: result.reference_id,
    credit_target: result.credit_target,
  });
}
