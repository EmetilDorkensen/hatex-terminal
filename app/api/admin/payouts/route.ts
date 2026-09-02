import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit-log';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  executeStripeBankPayout,
  refreshStripePayoutStatus,
  stripeConfigured,
} from '@/lib/payouts/providers/stripe';
import { getPayoutUsdRate, convertHtgToUsd } from '@/lib/payouts/rates';

const PAYOUT_SELECT = `
  id, payment_id, merchant_id, mode, receiver_provider, receiver_phone,
  amount, currency, amount_usd, rate_used, bank_account_id,
  status, attempt_count, next_retry_at, last_error,
  moncash_transaction_id, provider_transaction_id, reference,
  created_at, paid_at, confirmed_at, manual_note, wallet_full, hold_until,
  considered_lost_at, attempt_log,
  profiles ( email, full_name ),
  hatex_bank_accounts (
    id, kind, bank_name, account_name, account_number, routing_number,
    swift_code, stripe_connect_account_id, stripe_external_account_id
  )
`;

/** Admin: lapo payout (MonCash retry + payout bank / Stripe Connect tès). */
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  if (!(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Sesyon admin ekspire.' }, { status: 401 });
  }

  const db = createSupabaseAdminClient();

  const { data: payouts, error } = await db
    .from('hatex_payouts')
    .select(PAYOUT_SELECT)
    .order('created_at', { ascending: false })
    .limit(250);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: statusRows } = await db.from('hatex_payouts').select('status');
  const stats = { pending: 0, processing: 0, paid: 0, failed: 0, skipped: 0 };
  for (const row of statusRows || []) {
    const s = String(row.status) as keyof typeof stats;
    if (s in stats) stats[s] += 1;
  }

  return NextResponse.json({
    success: true,
    payouts: payouts || [],
    stats,
    stripe: { configured: stripeConfigured() },
  });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-payouts:${ip}`, 40, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  if (!(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Sesyon admin ekspire.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  const payoutId = String(body.payoutId || '');
  const note = String(body.note || '').trim().slice(0, 500) || null;
  const db = createSupabaseAdminClient();
  const email = admin.user.email || '';
  const userId = admin.user.id;
  const now = new Date().toISOString();

  if (!payoutId) {
    return NextResponse.json({ error: 'payoutId obligatwa.' }, { status: 400 });
  }

  if (action === 'confirm') {
    const { data: payout } = await db
      .from('hatex_payouts')
      .select('id, merchant_id, amount, currency, amount_usd')
      .eq('id', payoutId)
      .maybeSingle();
    if (!payout) return NextResponse.json({ error: 'Payout pa jwenn.' }, { status: 404 });

    const { error } = await db
      .from('hatex_payouts')
      .update({
        status: 'paid',
        paid_at: now,
        confirmed_by: userId,
        confirmed_at: now,
        manual_note: note,
        last_error: null,
        next_retry_at: null,
        updated_at: now,
      })
      .eq('id', payoutId)
      .in('status', ['pending', 'processing']);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const currency = String(payout.currency || 'HTG');
    const montan =
      currency === 'USD' && Number(payout.amount_usd) > 0
        ? `$${Number(payout.amount_usd).toFixed(2)} USD`
        : `${Number(payout.amount).toLocaleString('fr-FR')} HTG`;

    await db.from('hatex_notifications').insert({
      user_id: payout.merchant_id,
      kind: 'payout_paid',
      title: 'Payout peye',
      body: `${montan} — kòb la depoze nan kont ou.`,
      href: '/transactions',
    });

    await logAdminAction(db, {
      adminEmail: email,
      action: 'PAYOUT_CONFIRM_MANUAL',
      targetType: 'hatex_payouts',
      targetId: payoutId,
      details: { note },
      ip,
    });
    return NextResponse.json({ success: true, action, payoutId });
  }

  if (action === 'fail') {
    const { error } = await db
      .from('hatex_payouts')
      .update({
        status: 'failed',
        confirmed_by: userId,
        confirmed_at: now,
        manual_note: note,
        last_error: note || 'Refize pa admin.',
        next_retry_at: null,
        hold_until: null,
        updated_at: now,
      })
      .eq('id', payoutId)
      .in('status', ['pending', 'processing']);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: payout } = await db
      .from('hatex_payouts')
      .select('merchant_id, amount')
      .eq('id', payoutId)
      .maybeSingle();

    if (payout) {
      await db.from('hatex_notifications').insert({
        user_id: payout.merchant_id,
        kind: 'payout_failed',
        title: 'Payout refize',
        body: `Payout ${Number(payout.amount).toLocaleString('fr-FR')} HTG refize. Kontakte sipò pou plis enfòmasyon.`,
        href: '/transactions',
      });
    }

    await logAdminAction(db, {
      adminEmail: email,
      action: 'PAYOUT_FAIL_MANUAL',
      targetType: 'hatex_payouts',
      targetId: payoutId,
      details: { note },
      ip,
    });
    return NextResponse.json({ success: true, action, payoutId });
  }

  if (action === 'retry') {
    const { data: payout } = await db
      .from('hatex_payouts')
      .select('id, payment_id, merchant_id, amount, mode, reference, receiver_provider')
      .eq('id', payoutId)
      .maybeSingle();
    if (!payout) return NextResponse.json({ error: 'Payout pa jwenn.' }, { status: 404 });
    if (payout.receiver_provider !== 'moncash') {
      return NextResponse.json(
        { error: 'Sèlman payout MonCash ka relance otomatikman. Payout bank yo trete anba lapo admin.' },
        { status: 400 }
      );
    }

    const { executeMerchantPayout } = await import('@/lib/payouts/execute');
    const result = await executeMerchantPayout(db, {
      paymentId: payout.payment_id,
      merchantId: payout.merchant_id,
      amount: Number(payout.amount),
      mode: payout.mode as 'test' | 'live',
      reference: payout.reference,
    });

    await logAdminAction(db, {
      adminEmail: email,
      action: 'PAYOUT_RETRY',
      targetType: 'hatex_payouts',
      targetId: payoutId,
      details: { result },
      ip,
    });
    return NextResponse.json({ success: true, action, ...result });
  }

  if (action === 'stripe_pay') {
    const { data: payout } = await db
      .from('hatex_payouts')
      .select('id, merchant_id, amount, currency, amount_usd, rate_used, bank_account_id, status')
      .eq('id', payoutId)
      .maybeSingle();
    if (!payout) return NextResponse.json({ error: 'Payout pa jwenn.' }, { status: 404 });
    if (!['pending', 'failed'].includes(String(payout.status))) {
      return NextResponse.json({ error: 'Payout sa a pa an atant ankò.' }, { status: 400 });
    }
    if (!payout.bank_account_id) {
      return NextResponse.json({ error: 'Payout sa a pa gen yon kont bank.' }, { status: 400 });
    }

    const { data: bank } = await db
      .from('hatex_bank_accounts')
      .select('*')
      .eq('id', payout.bank_account_id)
      .maybeSingle();
    if (!bank) return NextResponse.json({ error: 'Kont bank pa jwenn.' }, { status: 404 });
    if (bank.kind !== 'bank_us') {
      return NextResponse.json({ error: 'Sèlman kont Bank USA ka voye via Stripe.' }, { status: 400 });
    }

    let amountUsd = Number(payout.amount_usd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      const rate =
        Number(payout.rate_used) > 0 ? Number(payout.rate_used) : await getPayoutUsdRate(db);
      amountUsd = convertHtgToUsd(Number(payout.amount), rate);
    }

    const { data: merchant } = await db
      .from('profiles')
      .select('email')
      .eq('id', payout.merchant_id)
      .maybeSingle();

    const result = await executeStripeBankPayout({
      admin: db,
      payoutId,
      amountUsd,
      bankAccount: bank as never,
      merchantEmail: merchant?.email || null,
    });

    if (!result.ok) {
      await db
        .from('hatex_payouts')
        .update({ last_error: result.message, updated_at: now })
        .eq('id', payoutId);
      await logAdminAction(db, {
        adminEmail: email,
        action: 'PAYOUT_STRIPE_FAIL',
        targetType: 'hatex_payouts',
        targetId: payoutId,
        details: { code: result.code, message: result.message },
        ip,
      });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    const { error } = await db
      .from('hatex_payouts')
      .update({
        status: 'processing',
        provider_transaction_id: result.transactionId,
        last_error: null,
        next_retry_at: null,
        updated_at: now,
      })
      .eq('id', payoutId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAdminAction(db, {
      adminEmail: email,
      action: 'PAYOUT_STRIPE_SENT',
      targetType: 'hatex_payouts',
      targetId: payoutId,
      details: { transactionId: result.transactionId, amountUsd, status: result.status },
      ip,
    });
    return NextResponse.json({ success: true, action, transactionId: result.transactionId });
  }


  if (action === 'stripe_refresh') {
    const { data: payout } = await db
      .from('hatex_payouts')
      .select('id, merchant_id, provider_transaction_id, status')
      .eq('id', payoutId)
      .maybeSingle();
    if (!payout) return NextResponse.json({ error: 'Payout pa jwenn.' }, { status: 404 });
    if (!payout.provider_transaction_id) {
      return NextResponse.json(
        { error: 'Pa gen ID tranzaksyon Stripe pou payout sa a.' },
        { status: 400 }
      );
    }

    const res = await refreshStripePayoutStatus(payout.provider_transaction_id);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });

    if (res.status === 'paid') {
      await db
        .from('hatex_payouts')
        .update({
          status: 'paid',
          paid_at: now,
          confirmed_by: userId,
          confirmed_at: now,
          manual_note: 'Konfime otomatikman — Stripe status "paid".',
          last_error: null,
          updated_at: now,
        })
        .eq('id', payoutId);
      await db.from('hatex_notifications').insert({
        user_id: payout.merchant_id,
        kind: 'payout_paid',
        title: 'Payout peye',
        body: 'Kòb la depoze nan kont bank ou (Stripe).',
        href: '/transactions',
      });
    } else if (res.status === 'canceled' || res.status === 'failed') {
      await db
        .from('hatex_payouts')
        .update({
          status: 'failed',
          last_error: `Stripe: ${res.status}`,
          confirmed_by: userId,
          confirmed_at: now,
          updated_at: now,
        })
        .eq('id', payoutId);
    } else {
      await db
        .from('hatex_payouts')
        .update({ status: 'processing', last_error: null, updated_at: now })
        .eq('id', payoutId);
    }

    await logAdminAction(db, {
      adminEmail: email,
      action: 'PAYOUT_STRIPE_REFRESH',
      targetType: 'hatex_payouts',
      targetId: payoutId,
      details: { transactionId: payout.provider_transaction_id, status: res.status },
      ip,
    });
    return NextResponse.json({ success: true, action, status: res.status });
  }

  return NextResponse.json({ error: 'Aksyon pa rekonèt.' }, { status: 400 });
}

