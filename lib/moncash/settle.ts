import type { SupabaseClient } from '@supabase/supabase-js';
import {
  retrieveMonCashOrder,
  retrieveMonCashTransaction,
  type MonCashPaymentDetails,
} from './client';
import { getMonCashConfigForGateway, type MonCashConfig } from './config';

/**
 * Règleman yon peman MonCash.
 *
 * Prensip sekirite: nou PA JANM fè konfyans sa navigatè a oswa yon webhook di.
 * Nou toujou rele MonCash tèt li (RetrieveOrder / RetrieveTransaction) pou
 * konfime peman an ak montan an anvan nou make l peye.
 */

export type SettleInput =
  | { gatewayOrderId: string; transactionId?: string }
  | { gatewayOrderId?: string; transactionId: string };

export type SettleResult =
  | {
      ok: true;
      alreadySettled: boolean;
      paymentId: string;
      merchantId: string;
      status: 'paid';
      payoutId: string | null;
    }
  | { ok: false; message: string; status?: number };

type PaymentRow = {
  id: string;
  merchant_id: string;
  mode: 'test' | 'live';
  status: string;
  purpose: 'merchant' | 'kyc_fee' | 'crypto_buy' | 'invoice' | 'plan_fee' | 'product';
  gateway_order_id: string;
  merchant_amount: number;
  platform_fee: number;
  client_total: number;
  moncash_transaction_id: string | null;
  metadata: Record<string, unknown> | null;
};

const PAYMENT_SELECT =
  'id, merchant_id, mode, status, purpose, gateway_order_id, merchant_amount, platform_fee, client_total, moncash_transaction_id, metadata';

async function findPayment(
  admin: SupabaseClient,
  input: SettleInput
): Promise<PaymentRow | null> {
  if (input.gatewayOrderId) {
    const { data } = await admin
      .from('hatex_payments')
      .select(PAYMENT_SELECT)
      .eq('gateway_order_id', input.gatewayOrderId)
      .maybeSingle();
    if (data) return data as PaymentRow;
  }

  if (input.transactionId) {
    const { data } = await admin
      .from('hatex_payments')
      .select(PAYMENT_SELECT)
      .eq('moncash_transaction_id', input.transactionId)
      .maybeSingle();
    if (data) return data as PaymentRow;
  }

  return null;
}

async function verifyWithMonCash(
  input: SettleInput,
  cfg: MonCashConfig,
  gatewayOrderId?: string
): Promise<{ ok: true; details: MonCashPaymentDetails } | { ok: false; message: string }> {
  const orderId = input.gatewayOrderId || gatewayOrderId;

  if (orderId) {
    const byOrder = await retrieveMonCashOrder(orderId, cfg);
    if (byOrder.ok) return { ok: true, details: byOrder.data };
    if (!input.transactionId) return { ok: false, message: byOrder.message };
  }

  if (input.transactionId) {
    const byTx = await retrieveMonCashTransaction(input.transactionId, cfg);
    if (byTx.ok) return { ok: true, details: byTx.data };
    return { ok: false, message: byTx.message };
  }

  return { ok: false, message: 'Pa gen referans pou verifye peman an.' };
}

/**
 * Konfime yon peman epi kreye liy payout la.
 * Idempotan — ou ka rele l plizyè fwa san danje (alert + retour navigatè).
 */
export async function settleMonCashPayment(
  admin: SupabaseClient,
  input: SettleInput
): Promise<SettleResult> {
  const payment = await findPayment(admin, input);
  if (!payment) {
    return { ok: false, message: 'Peman pa jwenn nan sistèm nan.', status: 404 };
  }

  if (payment.status === 'paid') {
    // Reeseye soumisyon an: si yon apèl anvan te make peman an peye men te
    // echwe sou soumisyon dosye a, moun nan pa dwe rete bloke. Operasyon an
    // idempotan.
    if (payment.purpose === 'product') {
      const { settleProductAfterMonCash } = await import('@/lib/products/pay');
      const r = await settleProductAfterMonCash(
        admin,
        payment.id,
        Number(payment.merchant_amount),
        payment.metadata
      );
      return {
        ok: true,
        alreadySettled: true,
        paymentId: payment.id,
        merchantId: payment.merchant_id,
        status: 'paid',
        payoutId: r.payoutId,
      };
    }

    if (payment.purpose === 'kyc_fee') {
      await submitKycApplicationForPayment(admin, payment);
      return {
        ok: true,
        alreadySettled: true,
        paymentId: payment.id,
        merchantId: payment.merchant_id,
        status: 'paid',
        payoutId: null,
      };
    }

    if (payment.purpose === 'crypto_buy') {
      // Sèvis kripto/Binance retire — jere istorik ansyen an san payout.
      return {
        ok: false,
        message: 'Sèvis kripto/Binance retire nan HatexCard.',
        status: 410,
      };
    }

    if (payment.purpose === 'invoice') {
      const { settleInvoiceAfterMonCash } = await import('@/lib/invoices/moncash-pay');
      const r = await settleInvoiceAfterMonCash(
        admin,
        payment.id,
        Number(payment.merchant_amount),
        payment.metadata
      );
      return {
        ok: true,
        alreadySettled: true,
        paymentId: payment.id,
        merchantId: payment.merchant_id,
        status: 'paid',
        payoutId: r.payoutId,
      };
    }

    if (payment.purpose === 'plan_fee') {
      await activatePaidPlanForPayment(admin, payment);
      return {
        ok: true,
        alreadySettled: true,
        paymentId: payment.id,
        merchantId: payment.merchant_id,
        status: 'paid',
        payoutId: null,
      };
    }

    const { data: existingPayout } = await admin
      .from('hatex_payouts')
      .select('id')
      .eq('payment_id', payment.id)
      .maybeSingle();

    return {
      ok: true,
      alreadySettled: true,
      paymentId: payment.id,
      merchantId: payment.merchant_id,
      status: 'paid',
      payoutId: existingPayout?.id || null,
    };
  }

  if (payment.status === 'cancelled') {
    return { ok: false, message: 'Peman sa a te anile.', status: 409 };
  }

  // Verifye sou anviwònman ki koresponn ak mòd peman an, pa sou mòd default la
  let cfg: MonCashConfig;
  try {
    cfg = getMonCashConfigForGateway(payment.mode);
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Konfigirasyon MonCash manke.',
      status: 500,
    };
  }

  const verified = await verifyWithMonCash(input, cfg, payment.gateway_order_id);
  if (!verified.ok) {
    return { ok: false, message: verified.message, status: 402 };
  }

  const details = verified.details;

  // Montan MonCash konfime dwe kouvri sa nou te mande
  if (Math.round(details.cost) < Math.round(Number(payment.client_total))) {
    await admin
      .from('hatex_payments')
      .update({
        status: 'failed',
        moncash_raw: details.raw as never,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    return {
      ok: false,
      message: `Montan peye a (${details.cost}) pi piti pase sa nou te mande (${payment.client_total}).`,
      status: 402,
    };
  }

  const now = new Date().toISOString();

  // Make peye — kondisyon sou status pou evite kous ant alert ak retour
  const { data: updated, error: updateErr } = await admin
    .from('hatex_payments')
    .update({
      status: 'paid',
      moncash_transaction_id: details.transactionId,
      payer_phone: details.payer || null,
      moncash_raw: details.raw as never,
      paid_at: now,
      updated_at: now,
    })
    .eq('id', payment.id)
    .in('status', ['pending', 'expired', 'failed'])
    .select('id')
    .maybeSingle();

  if (updateErr) {
    return { ok: false, message: updateErr.message, status: 500 };
  }

  if (!updated) {
    // Yon lòt apèl fin regle l anvan nou — sa se yon siksè
    if (payment.purpose === 'product') {
      const { settleProductAfterMonCash } = await import('@/lib/products/pay');
      const r = await settleProductAfterMonCash(
        admin,
        payment.id,
        Number(payment.merchant_amount),
        payment.metadata
      );
      return {
        ok: true,
        alreadySettled: true,
        paymentId: payment.id,
        merchantId: payment.merchant_id,
        status: 'paid',
        payoutId: r.payoutId,
      };
    }

    if (payment.purpose === 'kyc_fee') {
      await submitKycApplicationForPayment(admin, payment);
      return {
        ok: true,
        alreadySettled: true,
        paymentId: payment.id,
        merchantId: payment.merchant_id,
        status: 'paid',
        payoutId: null,
      };
    }

    if (payment.purpose === 'crypto_buy') {
      // Sèvis kripto/Binance retire — jere istorik ansyen an san payout.
      return {
        ok: false,
        message: 'Sèvis kripto/Binance retire nan HatexCard.',
        status: 410,
      };
    }

    if (payment.purpose === 'invoice') {
      const { settleInvoiceAfterMonCash } = await import('@/lib/invoices/moncash-pay');
      const r = await settleInvoiceAfterMonCash(
        admin,
        payment.id,
        Number(payment.merchant_amount),
        payment.metadata
      );
      return {
        ok: true,
        alreadySettled: true,
        paymentId: payment.id,
        merchantId: payment.merchant_id,
        status: 'paid',
        payoutId: r.payoutId,
      };
    }

    if (payment.purpose === 'plan_fee') {
      await activatePaidPlanForPayment(admin, payment);
      return {
        ok: true,
        alreadySettled: true,
        paymentId: payment.id,
        merchantId: payment.merchant_id,
        status: 'paid',
        payoutId: null,
      };
    }

    const { data: payout } = await admin
      .from('hatex_payouts')
      .select('id')
      .eq('payment_id', payment.id)
      .maybeSingle();

    return {
      ok: true,
      alreadySettled: true,
      paymentId: payment.id,
      merchantId: payment.merchant_id,
      status: 'paid',
      payoutId: payout?.id || null,
    };
  }

  // PREMYE RÈGLEMAN (nou menm ki fè tranzisyon an): voye imèl konfimasyon yo.
  // Se sèlman isit la — konsa rechaj/resettle pa janm voye doub imèl.
  {
    const { notifyPaymentPaid } = await import('@/lib/notify/sale-emails');
    await notifyPaymentPaid(admin, payment);
  }

  // Yon frè KYC pa gen payout — li debloke soumisyon dosye a olye
  if (payment.purpose === 'kyc_fee') {
    await submitKycApplicationForPayment(admin, payment);
    return {
      ok: true,
      alreadySettled: false,
      paymentId: payment.id,
      merchantId: payment.merchant_id,
      status: 'paid',
      payoutId: null,
    };
  }

  // Achte kripto: sèvis la retire — pa fè payout sou istorik ansyen
  if (payment.purpose === 'crypto_buy') {
    return {
      ok: false,
      message: 'Sèvis kripto/Binance retire nan HatexCard.',
      status: 410,
    };
  }

  // Fakti: make invoice paid + payout sou kont machann te chwazi
  if (payment.purpose === 'invoice') {
    const { settleInvoiceAfterMonCash } = await import('@/lib/invoices/moncash-pay');
    const r = await settleInvoiceAfterMonCash(
      admin,
      payment.id,
      Number(payment.merchant_amount),
      payment.metadata
    );
    return {
      ok: true,
      alreadySettled: false,
      paymentId: payment.id,
      merchantId: payment.merchant_id,
      status: 'paid',
      payoutId: r.payoutId,
    };
  }

  // Pwodwi: konte vant lan + payout sou kont machann te chwazi
  if (payment.purpose === 'product') {
    const { settleProductAfterMonCash } = await import('@/lib/products/pay');
    const r = await settleProductAfterMonCash(
      admin,
      payment.id,
      Number(payment.merchant_amount),
      payment.metadata
    );
    return {
      ok: true,
      alreadySettled: false,
      paymentId: payment.id,
      merchantId: payment.merchant_id,
      status: 'paid',
      payoutId: r.payoutId,
    };
  }

  if (payment.purpose === 'plan_fee') {
    await activatePaidPlanForPayment(admin, payment);
    return {
      ok: true,
      alreadySettled: false,
      paymentId: payment.id,
      merchantId: payment.merchant_id,
      status: 'paid',
      payoutId: null,
    };
  }

  const { executeMerchantPayout } = await import('@/lib/payouts/execute');
  const payout = await executeMerchantPayout(admin, {
    paymentId: payment.id,
    merchantId: payment.merchant_id,
    amount: Number(payment.merchant_amount),
    mode: payment.mode,
    reference: payment.gateway_order_id,
    description: `Peman HatexCard ${payment.gateway_order_id.slice(0, 10)}`,
  });

  return {
    ok: true,
    alreadySettled: false,
    paymentId: payment.id,
    merchantId: payment.merchant_id,
    status: 'paid',
    payoutId: payout.payoutId,
  };
}

/** Frè KYC konfime → dosye a pase nan revizyon. */
async function submitKycApplicationForPayment(
  admin: SupabaseClient,
  payment: PaymentRow
): Promise<void> {
  const applicationId = payment.metadata?.kyc_application_id;
  if (typeof applicationId !== 'string' || !applicationId) {
    console.error(`[settle] Peman KYC ${payment.id} pa gen kyc_application_id nan metadata.`);
    return;
  }

  const { markApplicationSubmitted } = await import('@/lib/kyc-v2/application');
  const result = await markApplicationSubmitted(
    admin,
    applicationId,
    payment.id,
    Number(payment.platform_fee || payment.client_total)
  );

  if (!result.ok) {
    console.error(`[settle] Pa t kapab soumèt dosye KYC ${applicationId}: ${result.message}`);
  }
}

/** Abonnman Kapasite / Premyòm konfime → aktive 30 jou. */
async function activatePaidPlanForPayment(
  admin: SupabaseClient,
  payment: PaymentRow
): Promise<void> {
  const plan =
    payment.metadata?.plan === 'premium' || payment.metadata?.plan === 'capacity'
      ? payment.metadata.plan
      : null;
  if (!plan) {
    console.error(`[settle] Peman plan ${payment.id} san plan nan metadata.`);
    return;
  }

  const start = new Date();
  const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = start.toISOString();

  await admin
    .from('profiles')
    .update({
      plan,
      plan_status: 'active',
      intended_plan: plan,
      plan_period_end: end.toISOString(),
      plan_selected_at: now,
    })
    .eq('id', payment.merchant_id);

  await admin.from('hatex_plan_subscriptions').insert({
    user_id: payment.merchant_id,
    plan,
    status: 'active',
    amount_htg: Number(payment.client_total || payment.platform_fee || 0),
    payment_id: payment.id,
    current_period_start: now,
    current_period_end: end.toISOString(),
  });

  await admin.from('hatex_notifications').insert({
    user_id: payment.merchant_id,
    kind: 'plan_active',
    title: plan === 'premium' ? 'Plan Premyòm aktif' : 'Plan Kapasite aktif',
    body:
      plan === 'premium'
        ? 'Kont ou san limit jou. Mete plizyè nimewo MonCash pou si youn plen.'
        : 'Ou ka resevwa jiska 150 000 HTG pa jou.',
    href: '/dashboard',
  });
}

/**
 * Re-eseye règleman pou peman pending (webhook pa rive, oswa localhost).
 * Si `merchantId` bay, limite sou moun sa a.
 */
export async function settlePendingMonCashPayments(
  admin: SupabaseClient,
  merchantId?: string
): Promise<{ checked: number; paid: number; failed: number }> {
  let query = admin
    .from('hatex_payments')
    .select('gateway_order_id, moncash_transaction_id, merchant_id')
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true })
    .limit(120);

  if (merchantId) query = query.eq('merchant_id', merchantId);

  const { data } = await query;
  let paid = 0;
  let failed = 0;
  for (const row of data || []) {
    try {
      const result = await settleMonCashPayment(admin, {
        gatewayOrderId: row.gateway_order_id,
        transactionId: row.moncash_transaction_id || undefined,
      } as SettleInput);
      if (result.ok) {
        paid += 1;
      } else {
        failed += 1;
        console.warn(
          `[moncash-settle] ${row.gateway_order_id} poko regle: ${result.message}`
        );
      }
    } catch (err) {
      failed += 1;
      console.error(
        `[moncash-settle] erè inatann sou ${row.gateway_order_id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  return { checked: (data || []).length, paid, failed };
}
