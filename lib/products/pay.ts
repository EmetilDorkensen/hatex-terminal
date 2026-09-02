import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMonCashPayment } from '@/lib/moncash/client';
import { getMonCashConfigForGateway, type GatewayMode } from '@/lib/moncash/config';
import { computeFees } from '@/lib/moncash/fees';
import { getGatewaySettings } from '@/lib/moncash/settings';
import {
  attemptMonCashUssdPush,
  flowMetadata,
  normalizeMonCashPhone,
  parseMonCashFlow,
} from '@/lib/moncash/ussd-push';
import { checkMerchantDailyReceive } from '@/lib/billing/receive-limit';
import { PAYER_LIMIT_MESSAGE } from '@/lib/billing/plans';
import { ensureProfileClientRef } from '@/lib/security/client-ref';

/**
 * Pwodwi → lyen peman piblik → MonCash.
 * Kliyan peye (HTG + frè). Machann lan resevwa sou kont li te chwazi
 * (MonCash / Natcash / bank HT). Bank USA endisponib pou kounya a.
 */

/** Mòd MonCash pou yon machann — baze sou api_key_mode li (default 'live'). */
async function merchantPaymentMode(
  admin: SupabaseClient,
  merchantId: string
): Promise<GatewayMode> {
  const { data: profile } = await admin
    .from('profiles')
    .select('api_key_mode')
    .eq('id', merchantId)
    .maybeSingle();
  return profile?.api_key_mode === 'test' ? 'test' : 'live';
}

export type ProductPayQuote = {
  productId: string;
  name: string;
  slug: string;
  priceHtg: number;
  platformFee: number;
  payoutFee: number;
  clientTotal: number;
  receiveBlocked: boolean;
  receiveMessage: string | null;
  remainingHtg: number | null;
  dailyLimitHtg: number | null;
};

export async function quoteProductMonCash(
  admin: SupabaseClient,
  productId: string
): Promise<
  | { ok: true; quote: ProductPayQuote }
  | { ok: false; status: number; message: string }
> {
  const { data: product } = await admin
    .from('hatex_products')
    .select('id, name, slug, price_htg, active, payout_account_id, owner_id')
    .eq('id', productId)
    .maybeSingle();

  if (!product) return { ok: false, status: 404, message: 'Pwodwi pa jwenn.' };
  if (!product.active) {
    return { ok: false, status: 409, message: 'Pwodwi sa a pa disponib kounye a.' };
  }
  if (!product.payout_account_id) {
    return {
      ok: false,
      status: 400,
      message: 'Machann lan poko chwazi kont pou resevwa lajan an.',
    };
  }

  const settings = await getGatewaySettings(admin);
  const amountHtg = Math.round(Number(product.price_htg));
  if (!Number.isFinite(amountHtg) || amountHtg < 10) {
    return { ok: false, status: 400, message: 'Pri pwodwi a pa valab.' };
  }

  const fees = computeFees(amountHtg, settings);
  if (!fees) return { ok: false, status: 400, message: 'Montan pa valab.' };

  const receive = await checkMerchantDailyReceive(admin, product.owner_id, fees.merchantAmount);
  const blocked = !receive.ok;

  return {
    ok: true,
    quote: {
      productId: product.id,
      name: product.name,
      slug: product.slug,
      priceHtg: fees.merchantAmount,
      platformFee: fees.platformFee,
      payoutFee: fees.payoutFee,
      clientTotal: fees.clientTotal,
      receiveBlocked: blocked,
      receiveMessage: blocked ? PAYER_LIMIT_MESSAGE : null,
      remainingHtg: receive.remaining,
      dailyLimitHtg: receive.limit,
    },
  };
}

export async function startProductMonCashPayment(
  admin: SupabaseClient,
  productId: string,
  returnUrl: string,
  options?: { customerPhone?: unknown; flow?: unknown }
): Promise<
  | {
      ok: true;
      checkoutUrl: string | null;
      checkoutMode: 'hosted' | 'ussd';
      paymentId: string;
      clientTotal: number;
    }
  | { ok: false; status: number; message: string }
> {
  const quoted = await quoteProductMonCash(admin, productId);
  if (!quoted.ok) return quoted;
  if (quoted.quote.receiveBlocked) {
    return { ok: false, status: 409, message: PAYER_LIMIT_MESSAGE };
  }

  const { data: product } = await admin
    .from('hatex_products')
    .select('id, name, price_htg, active, payout_account_id, owner_id')
    .eq('id', productId)
    .maybeSingle();

  if (!product || !product.active || !product.payout_account_id) {
    return { ok: false, status: 409, message: 'Pwodwi pa disponib pou peman.' };
  }

  const mode = await merchantPaymentMode(admin, product.owner_id);
  const q = quoted.quote;

  // Referans opak mèt pwodwi a — pou konnen kiyès k ap resevwa lajan an.
  const receiverRef = await ensureProfileClientRef(admin, product.owner_id);

  const gatewayOrderId = `hxprd_${crypto.randomBytes(14).toString('hex')}`;
  // merchant_order_id dwe inik pou chak tantativ (idx_hp_merchant_order) —
  // li pa janm dwe se id pwodwi a (sa ta kraze sou dezyèm acha a).
  const attemptOrderId = `prod_${crypto.randomBytes(8).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

  let cfg;
  try {
    cfg = getMonCashConfigForGateway(mode);
  } catch (e) {
    return {
      ok: false,
      status: 503,
      message: e instanceof Error ? e.message : 'MonCash pa konfigire.',
    };
  }

  const description = `Pwodwi ${String(product.name).slice(0, 40)}`;
  const flow = parseMonCashFlow(options?.flow);
  const phone = normalizeMonCashPhone(options?.customerPhone);

  let checkoutMode: 'hosted' | 'ussd' = 'hosted';
  let ussdReference: string | null = null;

  // Mòd USSD dirèk: eseye voye USSD sou telefòn kliyan an (lè Digicel API aktif).
  if (flow !== 'redirect') {
    const attempt = await attemptMonCashUssdPush({
      cfg,
      flow,
      phone,
      amount: q.clientTotal,
      orderId: gatewayOrderId,
      description,
    });
    if (attempt.ok) {
      checkoutMode = 'ussd';
      ussdReference = attempt.reference;
    } else if (flow === 'ussd') {
      return {
        ok: false,
        status:
          attempt.code === 'invalid_phone' ? 400 : attempt.code === 'not_configured' ? 503 : 502,
        message: attempt.message,
      };
    }
    // flow 'auto' + pa konfigire → tonbe sou mòd hosted (fallback) anba a.
  }

  let created: Awaited<ReturnType<typeof createMonCashPayment>> | null = null;
  if (checkoutMode === 'hosted') {
    created = await createMonCashPayment(gatewayOrderId, q.clientTotal, cfg);
    if (!created.ok) {
      return { ok: false, status: 502, message: created.message };
    }
  }

  const { data: payment, error: payErr } = await admin
    .from('hatex_payments')
    .insert({
      merchant_id: product.owner_id,
      mode,
      purpose: 'product',
      status: 'pending',
      merchant_order_id: attemptOrderId,
      gateway_order_id: gatewayOrderId,
      merchant_amount: q.priceHtg,
      platform_fee: q.platformFee,
      payout_fee: q.payoutFee,
      client_total: q.clientTotal,
      moncash_token: created?.data.token ?? null,
      payer_phone: phone,
      description,
      return_url: returnUrl,
      expires_at: expiresAt,
      metadata: flowMetadata(
        flow,
        ussdReference,
        receiverRef
          ? {
              product_id: product.id,
              payout_account_id: product.payout_account_id,
              receiver_ref: receiverRef,
            }
          : {
              product_id: product.id,
              payout_account_id: product.payout_account_id,
            }
      ),
    })
    .select('id')
    .maybeSingle();

  if (payErr || !payment) {
    return {
      ok: false,
      status: 500,
      message: payErr?.message || 'Pa t kapab sere peman an.',
    };
  }

  return {
    ok: true,
    checkoutUrl: created?.data.redirectUrl ?? null,
    checkoutMode,
    paymentId: payment.id,
    clientTotal: q.clientTotal,
  };
}


/** Apre MonCash konfime — konte vant lan epi kreye / voye payout. */
export async function settleProductAfterMonCash(
  admin: SupabaseClient,
  paymentId: string,
  merchantAmount: number,
  metadata: Record<string, unknown> | null
): Promise<{ payoutId: string | null; transferTx: string | null }> {
  const productId = typeof metadata?.product_id === 'string' ? metadata.product_id : null;
  const payoutAccountId =
    typeof metadata?.payout_account_id === 'string' ? metadata.payout_account_id : null;

  if (!productId) {
    console.error(`[settle-product] payment ${paymentId} san product_id`);
    return { payoutId: null, transferTx: null };
  }

  const { data: existingPayout } = await admin
    .from('hatex_payouts')
    .select('id, moncash_transaction_id')
    .eq('payment_id', paymentId)
    .maybeSingle();
  if (existingPayout) {
    return {
      payoutId: existingPayout.id,
      transferTx: existingPayout.moncash_transaction_id || null,
    };
  }

  const { data: product } = await admin
    .from('hatex_products')
    .select('id, owner_id, payout_account_id, sales_count, total_received_htg')
    .eq('id', productId)
    .maybeSingle();
  if (!product) return { payoutId: null, transferTx: null };

  const accountId = payoutAccountId || product.payout_account_id;
  if (!accountId) return { payoutId: null, transferTx: null };

  const { data: account } = await admin
    .from('hatex_bank_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', product.owner_id)
    .maybeSingle();
  if (!account) return { payoutId: null, transferTx: null };

  const now = new Date().toISOString();
  const amount = Number(merchantAmount) || 0;

  // Konte vant lan yon sèl fwa (egzistans payout pi wo a se gad la).
  await admin
    .from('hatex_products')
    .update({
      sales_count: Number(product.sales_count || 0) + 1,
      total_received_htg: Number(product.total_received_htg || 0) + amount,
      updated_at: now,
    })
    .eq('id', product.id);

  if (account.kind === 'moncash') {
    const { executeMerchantPayout } = await import('@/lib/payouts/execute');
    const r = await executeMerchantPayout(admin, {
      paymentId,
      merchantId: product.owner_id,
      amount,
      reference: `prdpay_${paymentId}`,
      description: `Pwodwi HatexCard ${product.id.slice(0, 8)}`,
      preferPhone: account.phone,
    });
    return { payoutId: r.payoutId, transferTx: r.transferTx };
  }

  // Natcash / bank — anrejistre pending (konfimasyon admin)
  const receiverPhone =
    account.phone || account.account_number || account.account_name || 'pending';

  const { getPayoutUsdRate, convertHtgToUsd } = await import('@/lib/payouts/rates');
  const rate = await getPayoutUsdRate(admin);
  const amountUsd = convertHtgToUsd(amount, rate);

  const { data: payout } = await admin
    .from('hatex_payouts')
    .insert({
      payment_id: paymentId,
      merchant_id: product.owner_id,
      mode: await merchantPaymentMode(admin, product.owner_id),
      receiver_provider: account.kind,
      receiver_phone: String(receiverPhone).slice(0, 64),
      amount,
      currency: account.kind === 'bank_us' ? 'USD' : 'HTG',
      amount_usd: account.kind === 'bank_us' && amountUsd > 0 ? amountUsd : null,
      rate_used: account.kind === 'bank_us' ? rate : null,
      bank_account_id: account.id,
      status: 'pending',
      reference: `prdpay_${paymentId}`,
      last_error:
        account.kind === 'bank_us'
          ? 'Virman USA — an atant konfimasyon admin (Stripe Connect tès).'
          : `Payout ${account.kind} an atant konfimasyon admin`,
    })
    .select('id')
    .maybeSingle();

  await admin.from('hatex_notifications').insert({
    user_id: product.owner_id,
    kind: 'product_sale',
    title: 'Pwodwi peye',
    body: `${Math.round(amount).toLocaleString()} HTG — payout sou ${account.kind} an atant.`,
    href: '/dashboard/products',
  });

  return { payoutId: payout?.id || null, transferTx: null };
}

