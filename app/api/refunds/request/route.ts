import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { requireMoneySession } from '@/lib/security/require-money-session';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { resolveRefundFromBuyerTx } from '@/lib/refunds/resolve-from-buyer';
import { sendRefundRequestMerchantEmail } from '@/lib/reservations/notify-refund';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Kliyan mande ranbousman soti nan istorik (debit tx).
 * Body: { buyer_tx_id, reason }
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`refund-request:${ip}`, 10, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp demann.' }, { status: 429 });
  }

  const auth = await requireMoneySession();
  if (!auth.ok) return auth.response;
  const buyerId = auth.user.id;

  const body = await req.json().catch(() => ({}));
  const buyerTxId = String(body.buyer_tx_id || '').trim();
  const reason = String(body.reason || '').trim().slice(0, 800);

  if (!UUID_RE.test(buyerTxId)) {
    return NextResponse.json({ success: false, message: 'Tranzaksyon pa valab.' }, { status: 400 });
  }
  if (reason.length < 5) {
    return NextResponse.json(
      { success: false, message: 'Rezon ranbousman obligatwa (omwen 5 karaktè).' },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const resolved = await resolveRefundFromBuyerTx(admin, buyerId, buyerTxId);
  if (!resolved.ok) {
    return NextResponse.json({ success: false, message: resolved.message }, { status: 400 });
  }

  const r = resolved.resolved;
  if (r.merchant_id === buyerId) {
    return NextResponse.json({ success: false, message: 'Ou pa ka mande ranbousman tèt ou.' }, { status: 400 });
  }

  // Deja gen demann pending?
  const { data: existing } = await admin
    .from('hatex_refund_requests')
    .select('id, status')
    .eq('source', r.source)
    .eq('source_id', r.source_id)
    .eq('buyer_id', buyerId)
    .maybeSingle();

  if (existing?.status === 'pending') {
    return NextResponse.json({ success: false, message: 'Ou deja gen yon demann an atant.' }, { status: 400 });
  }
  if (existing?.status === 'refunded') {
    return NextResponse.json({ success: false, message: 'Sa a te deja ranbouse.' }, { status: 400 });
  }

  // Deja nan ledger ranbousman?
  const { data: already } = await admin
    .from('hatex_refunds')
    .select('id')
    .eq('source', r.source)
    .eq('source_id', r.source_id)
    .maybeSingle();
  if (already) {
    return NextResponse.json({ success: false, message: 'Deja ranbouse.' }, { status: 400 });
  }

  const [{ data: buyer }, { data: merchant }] = await Promise.all([
    admin.from('profiles').select('full_name, email').eq('id', buyerId).maybeSingle(),
    admin
      .from('profiles')
      .select('full_name, email, business_name')
      .eq('id', r.merchant_id)
      .maybeSingle(),
  ]);

  const buyerName = buyer?.full_name || 'Yon kliyan';
  const serviceTitle = r.title || 'sèvis';
  const amountLabel = Number(r.amount).toLocaleString();

  const noticeDesc = `${buyerName} ki te peye w « ${serviceTitle} » ap mande ranbousman (${amountLabel} HTG) paske: ${reason}`;

  const { data: noticeTx, error: noticeErr } = await admin
    .from('transactions')
    .insert({
      user_id: r.merchant_id,
      amount: 0,
      type: 'REFUND_REQUEST',
      description: noticeDesc.slice(0, 500),
      status: 'pending',
      metadata: {
        kind: 'refund_request',
        source: r.source,
        source_id: r.source_id,
        buyer_id: buyerId,
        buyer_name: buyerName,
        buyer_email: buyer?.email || null,
        buyer_tx_id: buyerTxId,
        merchant_credit_tx_id: r.merchant_tx_id,
        amount: r.amount,
        title: serviceTitle,
        reason,
        refunded: false,
      },
    })
    .select('id')
    .single();

  if (noticeErr || !noticeTx) {
    return NextResponse.json(
      { success: false, message: noticeErr?.message || 'Pa t kapab kreye notifikasyon.' },
      { status: 400 }
    );
  }

  const { error: reqErr } = await admin.from('hatex_refund_requests').upsert(
    {
      buyer_id: buyerId,
      merchant_id: r.merchant_id,
      source: r.source,
      source_id: r.source_id,
      buyer_tx_id: buyerTxId,
      merchant_tx_id: r.merchant_tx_id,
      amount: r.amount,
      title: serviceTitle,
      reason,
      status: 'pending',
      merchant_notice_tx_id: noticeTx.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'source,source_id,buyer_id' }
  );

  if (reqErr) {
    return NextResponse.json({ success: false, message: reqErr.message }, { status: 400 });
  }

  // Stamp buyer tx
  const { data: buyerTx } = await admin
    .from('transactions')
    .select('metadata')
    .eq('id', buyerTxId)
    .maybeSingle();
  const bMeta =
    buyerTx?.metadata && typeof buyerTx.metadata === 'object' ? (buyerTx.metadata as object) : {};
  await admin
    .from('transactions')
    .update({
      metadata: {
        ...bMeta,
        refund_requested: true,
        refund_request_reason: reason,
        refund_request_at: new Date().toISOString(),
      },
    })
    .eq('id', buyerTxId)
    .eq('user_id', buyerId);

  try {
    await sendRefundRequestMerchantEmail({
      merchantEmail: merchant?.email,
      merchantName: merchant?.business_name || merchant?.full_name,
      buyerName,
      buyerEmail: buyer?.email,
      amount: r.amount,
      title: serviceTitle,
      reason,
    });
  } catch {
    /* pa kraze */
  }

  return NextResponse.json({
    success: true,
    message: 'Demann ranbousman voye bay machann nan.',
  });
}
