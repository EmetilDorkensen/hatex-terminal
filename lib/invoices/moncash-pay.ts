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
import { fetchInvoiceById } from '@/lib/invoices/ref';
import { ensureProfileClientRef } from '@/lib/security/client-ref';
import {
  attemptIsReusable,
  findMerchantAttempt,
  insertAttempt,
  refreshAttempt,
} from '@/lib/moncash/attempts';

/**
 * Fakti → MonCash.
 * Kliyan peye (HTG + frè). Machann resevwa sou kont li te chwazi
 * (MonCash / Natcash / bank HT / bank US).
 */

/** Mòd MonCash pou yon machann — baze sou api_key_mode li (default 'live'). */
async function merchantPaymentMode(admin: SupabaseClient, merchantId: string): Promise<GatewayMode> {
  const { data: profile } = await admin
    .from('profiles')
    .select('api_key_mode')
    .eq('id', merchantId)
    .maybeSingle();
  return profile?.api_key_mode === 'test' ? 'test' : 'live';
}


export type InvoicePayQuote = {
  invoiceId: string;
  currency: 'HTG' | 'USD';
  amountOriginal: number;
  amountHtg: number;
  usdRate: number | null;
  platformFee: number;
  payoutFee: number;
  clientTotal: number;
  receiveBlocked: boolean;
  receiveMessage: string | null;
  remainingHtg: number | null;
  dailyLimitHtg: number | null;
  paymentMethods: Array<{ id: string; label: string; available: boolean; soon?: boolean }>;
};

export async function quoteInvoiceMonCash(
  admin: SupabaseClient,
  invoiceId: string
): Promise<{ ok: true; quote: InvoicePayQuote } | { ok: false; status: number; message: string }> {
  const { data: inv } = await admin
    .from('invoices')
    .select('id, amount, currency, status, payout_account_id, owner_id')
    .eq('id', invoiceId)
    .maybeSingle();

  if (!inv) return { ok: false, status: 404, message: 'Fakti pa jwenn.' };
  if (inv.status === 'paid') return { ok: false, status: 409, message: 'Fakti sa a deja peye.' };
  if (inv.status !== 'pending') {
    return { ok: false, status: 409, message: `Fakti nan eta ${inv.status}.` };
  }

  const settings = await getGatewaySettings(admin);
  const { data: rateRow } = await admin
    .from('hatex_gateway_settings')
    .select('value')
    .eq('key', 'usd_htg_rate')
    .maybeSingle();
  const usdRate = Number(rateRow?.value) || 132;
  const currency = (inv.currency === 'USD' ? 'USD' : 'HTG') as 'HTG' | 'USD';
  const amountOriginal = Number(inv.amount);
  const amountHtg =
    currency === 'USD' ? Math.round(amountOriginal * usdRate) : Math.round(amountOriginal);

  const fees = computeFees(amountHtg, settings);
  if (!fees) return { ok: false, status: 400, message: 'Montan pa valab.' };

  const receive = await checkMerchantDailyReceive(admin, inv.owner_id, fees.merchantAmount);
  const blocked = !receive.ok;

  return {
    ok: true,
    quote: {
      invoiceId: inv.id,
      currency,
      amountOriginal,
      amountHtg: fees.merchantAmount,
      usdRate: currency === 'USD' ? usdRate : null,
      platformFee: fees.platformFee,
      payoutFee: fees.payoutFee,
      clientTotal: fees.clientTotal,
      receiveBlocked: blocked,
      receiveMessage: blocked ? PAYER_LIMIT_MESSAGE : null,
      remainingHtg: receive.remaining,
      dailyLimitHtg: receive.limit,
      paymentMethods: [
        { id: 'moncash', label: 'MonCash', available: !blocked },
        { id: 'natcash', label: 'Natcash', available: false, soon: true },
        { id: 'visa', label: 'Visa / Mastercard (Stripe)', available: false, soon: true },
      ],
    },
  };
}

export async function startInvoiceMonCashPayment(
  admin: SupabaseClient,
  invoiceId: string,
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
  const quoted = await quoteInvoiceMonCash(admin, invoiceId);
  if (!quoted.ok) return quoted;
  if (quoted.quote.receiveBlocked) {
    return { ok: false, status: 409, message: PAYER_LIMIT_MESSAGE };
  }

  const rawInv = await fetchInvoiceById(admin, invoiceId, [
    'id',
    'owner_id',
    'status',
    'payment_id',
    'payout_account_id',
  ]);
  const inv = rawInv as
    | (Record<string, unknown> & {
        id: string;
        owner_id: string;
        status: string;
        payment_id: string | null;
        payout_account_id: string | null;
        share_token?: string | null;
      })
    | null;

  if (!inv || inv.status !== 'pending') {
    return { ok: false, status: 409, message: 'Fakti pa disponib pou peman.' };
  }

  if (!inv.payout_account_id) {
    return {
      ok: false,
      status: 400,
      message: 'Machann lan poko chwazi kote pou resevwa kob la.',
    };
  }

  const mode = await merchantPaymentMode(admin, inv.owner_id);
  const q = quoted.quote;

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

  // Yon sèl tantativ "pending" pa fakti — nou pa janm kreye de sesyon
  // MonCash pou menm fakti a (gad kont doub peman + idx_hp_merchant_order).
  const invoiceRef = inv.share_token || inv.id;
  const merchantOrderId = `invoice_${invoiceRef}`;

  // Referans opak mèt fakti a — pou konnen kiyès k ap resevwa lajan an.
  const receiverRef = await ensureProfileClientRef(admin, inv.owner_id);
  let existing = await findMerchantAttempt(admin, inv.owner_id, merchantOrderId, mode);

  // Pandan tranzisyon (fakti ki te egziste anvan share_token), yon tantativ
  // ka rete sou vye prefix `invoice_<uuid>`. Nou jwenn li nan metadata epi nou
  // reutilize/rafrechi li — pou pa janm gen de sesyon pou menm fakti a.
  if (!existing) {
    const { data: legacy } = await admin
      .from('hatex_payments')
      .select('id')
      .eq('merchant_id', inv.owner_id)
      .eq('purpose', 'invoice')
      .eq('mode', mode)
      .filter('metadata->>invoice_id', 'eq', invoiceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (legacy?.id) {
      const { data: byId } = await admin
        .from('hatex_payments')
        .select('id, purpose, status, expires_at, moncash_token, gateway_order_id, metadata')
        .eq('id', legacy.id)
        .maybeSingle();
      existing = byId
        ? (byId as {
            id: string;
            purpose: string;
            status: string;
            expires_at: string | null;
            moncash_token: string | null;
            gateway_order_id: string | null;
            metadata: Record<string, unknown> | null;
          })
        : null;
    }
  }

  if (existing?.status === 'paid') {
    return { ok: false, status: 409, message: 'Fakti sa a deja peye.' };
  }

  if (existing && attemptIsReusable(existing)) {
    // Kliyan an te klike de fwa / paj la te reload: reutilize sesyon an.
    if (existing.moncash_token) {
      return {
        ok: true,
        checkoutUrl: `${cfg.gatewayBase}/Payment/Redirect?token=${encodeURIComponent(
          existing.moncash_token
        )}`,
        checkoutMode: 'hosted' as const,
        paymentId: existing.id,
        clientTotal: q.clientTotal,
      };
    }
    const ussdRef =
      typeof existing.metadata?.ussd_reference === 'string'
        ? existing.metadata.ussd_reference
        : null;
    if (ussdRef) {
      return {
        ok: true,
        checkoutUrl: null,
        checkoutMode: 'ussd' as const,
        paymentId: existing.id,
        clientTotal: q.clientTotal,
      };
    }
  }

  const gatewayOrderId = `hxinv_${crypto.randomBytes(14).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

  const description = `Fakti ${invoiceRef.slice(0, 8)}`;
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

  const receiverMeta: Record<string, unknown> = {
    invoice_id: inv.id,
    payout_account_id: inv.payout_account_id,
    currency: q.currency,
    usd_rate: q.usdRate,
  };
  if (receiverRef) receiverMeta.receiver_ref = receiverRef;
  const sharedMetadata = flowMetadata(flow, ussdReference, receiverMeta);
  const values = {
    merchant_amount: q.amountHtg,
    platform_fee: q.platformFee,
    payout_fee: q.payoutFee,
    client_total: q.clientTotal,
    moncash_token: created?.data.token ?? null,
    payer_phone: phone,
    description,
    return_url: returnUrl,
    metadata: sharedMetadata,
  };

  const attemptResult = existing
    ? await refreshAttempt(admin, inv.owner_id, merchantOrderId, mode, existing, {
        gateway_order_id: gatewayOrderId,
        expires_at: expiresAt,
        ...values,
      })
    : await insertAttempt(admin, {
        merchant_id: inv.owner_id,
        merchant_order_id: merchantOrderId,
        gateway_order_id: gatewayOrderId,
        purpose: 'invoice',
        mode,
        expires_at: expiresAt,
        ...values,
      });

  if (!attemptResult.ok) {
    return { ok: false, status: attemptResult.status, message: attemptResult.message };
  }

  // Si kous la te rale yon liy ki deja peye, nou pa ka ba kliyan an ankò.
  if (attemptResult.row.status === 'paid') {
    return { ok: false, status: 409, message: 'Fakti sa a deja peye.' };
  }

  await admin
    .from('invoices')
    .update({
      payment_id: attemptResult.row.id,
      client_total_htg: q.clientTotal,
      platform_fee_htg: q.platformFee,
      payout_fee_htg: q.payoutFee,
      usd_rate_used: q.usdRate,
    })
    .eq('id', inv.id);

  return {
    ok: true,
    checkoutUrl: created?.data.redirectUrl ?? null,
    checkoutMode,
    paymentId: attemptResult.row.id,
    clientTotal: q.clientTotal,
  };
}

/** Apre MonCash konfime — make fakti peye epi kreye / voye payout. */
export async function settleInvoiceAfterMonCash(
  admin: SupabaseClient,
  paymentId: string,
  merchantAmount: number,
  metadata: Record<string, unknown> | null
): Promise<{ payoutId: string | null; transferTx: string | null }> {
  const invoiceId = typeof metadata?.invoice_id === 'string' ? metadata.invoice_id : null;
  const payoutAccountId =
    typeof metadata?.payout_account_id === 'string' ? metadata.payout_account_id : null;

  if (!invoiceId) {
    console.error(`[settle-invoice] payment ${paymentId} san invoice_id`);
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

  const now = new Date().toISOString();

  // Gad anti-doub-peman: sèlman yon fakti ki toujou 'pending' ka vin 'paid'.
  // Si yon konfimasyon anvan te deja fè li, nou soti san nou pa fè okenn payout.
  const { data: inv } = await admin
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: now,
      payment_id: paymentId,
    })
    .eq('id', invoiceId)
    .eq('status', 'pending')
    .select('id, owner_id, payout_account_id')
    .maybeSingle();

  if (!inv) return { payoutId: null, transferTx: null };

  const accountId = payoutAccountId || inv.payout_account_id;
  if (!accountId) return { payoutId: null, transferTx: null };

  const { data: account } = await admin
    .from('hatex_bank_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', inv.owner_id)
    .maybeSingle();

  if (!account) return { payoutId: null, transferTx: null };

  if (account.kind === 'moncash') {
    const { executeMerchantPayout } = await import('@/lib/payouts/execute');
    const r = await executeMerchantPayout(admin, {
      paymentId,
      merchantId: inv.owner_id,
      amount: merchantAmount,
      reference: `inv_${invoiceId}`,
      description: `Fakti HatexCard ${invoiceId.slice(0, 8)}`,
      preferPhone: account.phone,
    });
    return { payoutId: r.payoutId, transferTx: r.transferTx };
  }

  // Natcash / bank / bank_us — anrejistre pending (konfimasyon admin / Stripe pita)
  const receiverPhone =
    account.phone ||
    account.account_number ||
    account.account_name ||
    'pending';

  // Konvèsyon USD pou kont bank USA — to a soti nan hatex_gateway_settings
  const { getPayoutUsdRate, convertHtgToUsd } = await import('@/lib/payouts/rates');
  const rate = await getPayoutUsdRate(admin);
  const amountUsd = convertHtgToUsd(Number(merchantAmount), rate);

  const { data: payout } = await admin
    .from('hatex_payouts')
    .insert({
      payment_id: paymentId,
      merchant_id: inv.owner_id,
      mode: await merchantPaymentMode(admin, inv.owner_id),

      receiver_provider: account.kind,
      receiver_phone: String(receiverPhone).slice(0, 64),
      amount: merchantAmount,
      currency: account.kind === 'bank_us' ? 'USD' : 'HTG',
      amount_usd: account.kind === 'bank_us' && amountUsd > 0 ? amountUsd : null,
      rate_used: account.kind === 'bank_us' ? rate : null,
      bank_account_id: account.id,
      status: 'pending',
      reference: `inv_${invoiceId}`,
      last_error:
        account.kind === 'bank_us'
          ? 'Virman USA — an atant konfimasyon admin (Stripe Connect tès).'
          : `Payout ${account.kind} an atant konfimasyon admin`,
    })
    .select('id')
    .maybeSingle();

  await admin.from('hatex_notifications').insert({
    user_id: inv.owner_id,
    kind: 'invoice_paid',
    title: 'Fakti peye',
    body: `${Number(merchantAmount).toLocaleString()} HTG — payout sou ${account.kind} an atant.`,
    href: '/invoice',
  });

  return { payoutId: payout?.id || null, transferTx: null };
}
