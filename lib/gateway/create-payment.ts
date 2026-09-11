import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMonCashPayment } from '@/lib/moncash/client';
import { getMonCashConfigForGateway, type GatewayMode } from '@/lib/moncash/config';
import { computeFees } from '@/lib/moncash/fees';
import { getGatewaySettings } from '@/lib/moncash/settings';
import {
  attemptMonCashUssdPush,
  flowMetadata,
  parseMonCashFlow,
  type MonCashFlowMode,
} from '@/lib/moncash/ussd-push';
import { safeExternalUrl } from '@/lib/security/safe-url';
import { publicSiteUrl } from '@/lib/urls/public';
import type { MerchantAccount } from './auth';
import { checkAmountLimits, checkMonthlyLimit } from './limits';
import { checkMerchantDailyReceive } from '@/lib/billing/receive-limit';
import { PAYER_LIMIT_MESSAGE } from '@/lib/billing/plans';

/**
 * Kreyasyon yon peman: valide, kalkile frè, sere l, epi mande MonCash yon lyen
 * checkout.
 *
 * Nou sere liy peman an AVAN nou rele MonCash. Konsa si MonCash reyisi men
 * repons nou pèdi sou wout la, peman an egziste toujou nan sistèm nan epi
 * webhook la ap ka regle l.
 */

export type CreatePaymentInput = {
  amount: unknown;
  orderId: unknown;
  description?: unknown;
  returnUrl?: unknown;
  customerPhone?: unknown;
  /** 'auto' (default) | 'redirect' | 'ussd' */
  flow?: unknown;
  metadata?: unknown;
};

export type PaymentResource = {
  id: string;
  mode: GatewayMode;
  status: string;
  order_id: string;
  reference: string;
  amount: {
    currency: 'HTG';
    merchant: number;
    platform_fee: number;
    payout_fee: number;
    client_total: number;
  };
  /**
   * Paj peman HatexCard-hosted la (https://hatexcard.com/checkout/<id>).
   * Voye kliyan an la — li peye menm jan ak pwodwi/fakti (nimewo MonCash +
   * konfimasyon sou telefòn li), SAN redireksyon sou paj eksteryè.
   */
  checkout_url: string | null;
  /** Lyen dirèk paj MonCash Digicel la (pou entegrasyon avanse sèlman). */
  moncash_url: string | null;
  /** 'ussd' lè MonCash voye yon USSD dirèk sou telefòn kliyan an (pa gen paj). */
  checkout_mode: 'hosted' | 'ussd';
  description: string | null;
  return_url: string | null;
  expires_at: string | null;
  created_at: string;
  paid_at: string | null;
};

export type CreatePaymentOk = {
  ok: true;
  /** True lè demann lan se yon repriz yon peman ki deja egziste. */
  idempotent: boolean;
  payment: PaymentResource;
};

export type CreatePaymentError = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type CreatePaymentResult = CreatePaymentOk | CreatePaymentError;

const MAX_ORDER_ID_LEN = 64;
const MAX_DESCRIPTION_LEN = 200;
const MAX_METADATA_BYTES = 4096;

function fail(status: number, code: string, message: string): CreatePaymentError {
  return { ok: false, status, code, message };
}

function newGatewayOrderId(mode: GatewayMode): string {
  return `hx${mode === 'live' ? 'l' : 't'}_${crypto.randomBytes(16).toString('hex')}`;
}

export type PaymentRow = {
  id: string;
  mode: GatewayMode;
  status: string;
  merchant_order_id: string;
  gateway_order_id: string;
  merchant_amount: number;
  platform_fee: number;
  payout_fee: number;
  client_total: number;
  moncash_token: string | null;
  payer_phone: string | null;
  metadata: Record<string, unknown> | null;
  description: string | null;
  return_url: string | null;
  expires_at: string | null;
  created_at: string;
  paid_at: string | null;
};

// Yon sèl literal (pa konkatene): Supabase bezwen sa pou l ka enfere tip yo.
export const PAYMENT_SELECT =
  'id, mode, status, merchant_order_id, gateway_order_id, merchant_amount, platform_fee, payout_fee, client_total, moncash_token, payer_phone, metadata, description, return_url, expires_at, created_at, paid_at';

/** 'ussd' lè peman an te kòmanse ak yon push USSD dirèk (Digicel API aktif). */
export function checkoutModeOf(row: {
  metadata: Record<string, unknown> | null;
}): 'hosted' | 'ussd' {
  return row.metadata?.moncash_flow === 'ussd_push' ? 'ussd' : 'hosted';
}

/** Paj checkout HatexCard-hosted la — sèlman lè peman an toujou pending. */
export function hostedCheckoutUrl(row: { id: string; status: string }): string | null {
  if (row.status !== 'pending') return null;
  return `${publicSiteUrl()}/checkout/${row.id}`;
}

export function toPaymentResource(row: PaymentRow, moncashUrl: string | null): PaymentResource {
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    order_id: row.merchant_order_id,
    reference: row.gateway_order_id,
    amount: {
      currency: 'HTG',
      merchant: Number(row.merchant_amount),
      platform_fee: Number(row.platform_fee),
      payout_fee: Number(row.payout_fee),
      client_total: Number(row.client_total),
    },
    checkout_url: hostedCheckoutUrl(row),
    moncash_url: moncashUrl,
    checkout_mode: checkoutModeOf(row),
    description: row.description,
    return_url: row.return_url,
    expires_at: row.expires_at,
    created_at: row.created_at,
    paid_at: row.paid_at,
  };
}

/** Rebati lyen checkout la depi token MonCash ki sere a. */
export function checkoutUrlFor(row: {
  mode: GatewayMode;
  moncash_token: string | null;
}): string | null {
  if (!row.moncash_token) return null;
  try {
    const cfg = getMonCashConfigForGateway(row.mode);
    return `${cfg.gatewayBase}/Payment/Redirect?token=${encodeURIComponent(row.moncash_token)}`;
  } catch {
    return null;
  }
}

function validateInput(
  input: CreatePaymentInput,
  mode: GatewayMode
):
  | {
      ok: true;
      amount: number;
      orderId: string;
      description: string | null;
      returnUrl: string | null;
      customerPhone: string | null;
      flow: MonCashFlowMode;
      metadata: Record<string, unknown> | null;
    }
  | CreatePaymentError {
  const rawFlow = input.flow ?? 'auto';
  const flow = parseMonCashFlow(rawFlow);
  if (String(rawFlow).trim() !== '' && String(rawFlow).trim() !== 'auto' && String(rawFlow).trim().toLowerCase() !== 'redirect' && String(rawFlow).trim().toLowerCase() !== 'ussd') {
    return fail(400, 'invalid_flow', 'Chan `flow` dwe se "auto", "redirect" oswa "ussd".');
  }
  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail(400, 'invalid_amount', 'Chan `amount` dwe yon nonb HTG pozitif.');
  }

  const orderId = typeof input.orderId === 'string' ? input.orderId.trim() : '';
  if (!orderId) {
    return fail(400, 'missing_order_id', 'Chan `order_id` obligatwa (referans kòmand ou).');
  }
  if (orderId.length > MAX_ORDER_ID_LEN) {
    return fail(
      400,
      'order_id_too_long',
      `Chan \`order_id\` pa ka depase ${MAX_ORDER_ID_LEN} karaktè.`
    );
  }

  let description: string | null = null;
  if (input.description != null) {
    if (typeof input.description !== 'string') {
      return fail(400, 'invalid_description', 'Chan `description` dwe yon tèks.');
    }
    description = input.description.trim().slice(0, MAX_DESCRIPTION_LEN) || null;
  }

  let returnUrl: string | null = null;
  if (input.returnUrl != null) {
    if (typeof input.returnUrl !== 'string') {
      return fail(400, 'invalid_return_url', 'Chan `return_url` dwe yon URL.');
    }
    const normalized = safeExternalUrl(input.returnUrl);
    if (!normalized) {
      return fail(400, 'invalid_return_url', 'Chan `return_url` dwe yon URL http(s) valab.');
    }
    const parsed = new URL(normalized);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (mode === 'live' && parsed.protocol !== 'https:') {
      return fail(400, 'insecure_return_url', 'An mòd live, `return_url` dwe sèvi ak https.');
    }
    if (mode === 'live' && isLocal) {
      return fail(400, 'invalid_return_url', 'An mòd live, `return_url` pa ka pwente sou localhost.');
    }
    returnUrl = normalized;
  }

  let customerPhone: string | null = null;
  if (input.customerPhone != null) {
    if (typeof input.customerPhone !== 'string') {
      return fail(400, 'invalid_customer_phone', 'Chan `customer_phone` dwe yon tèks.');
    }
    const digits = input.customerPhone.replace(/\D/g, '');
    customerPhone = digits ? digits.slice(0, 15) : null;
  }

  let metadata: Record<string, unknown> | null = null;
  if (input.metadata != null) {
    if (typeof input.metadata !== 'object' || Array.isArray(input.metadata)) {
      return fail(400, 'invalid_metadata', 'Chan `metadata` dwe yon objè JSON.');
    }
    const serialized = JSON.stringify(input.metadata);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_METADATA_BYTES) {
      return fail(
        400,
        'metadata_too_large',
        `Chan \`metadata\` pa ka depase ${MAX_METADATA_BYTES} bay.`
      );
    }
    metadata = input.metadata as Record<string, unknown>;
  }

  return { ok: true, amount, orderId, description, returnUrl, customerPhone, flow, metadata };
}

export async function createGatewayPayment(
  admin: SupabaseClient,
  params: {
    merchantId: string;
    apiKeyId: string;
    mode: GatewayMode;
    account: MerchantAccount;
    input: CreatePaymentInput;
  }
): Promise<CreatePaymentResult> {
  const { merchantId, apiKeyId, mode, account, input } = params;

  // Konfigirasyon MonCash dwe egziste pou mòd sa a anvan nou fè lòt travay
  try {
    getMonCashConfigForGateway(mode);
  } catch (err) {
    return fail(
      503,
      'gateway_unavailable',
      err instanceof Error ? err.message : 'Pasrèl peman an pa disponib.'
    );
  }

  const validated = validateInput(input, mode);
  if (!('ok' in validated) || validated.ok !== true) return validated as CreatePaymentError;

  const settings = await getGatewaySettings(admin);

  const amountCheck = checkAmountLimits(validated.amount, account, settings);
  if (!amountCheck.ok) {
    return fail(amountCheck.status, amountCheck.code, amountCheck.message);
  }

  const fees = computeFees(validated.amount, settings);
  if (!fees) {
    return fail(400, 'invalid_amount', 'Pa t kapab kalkile frè pou montan sa a.');
  }

  // Idempotans: menm (machann, order_id, mòd) = menm peman
  const { data: existingRow } = await admin
    .from('hatex_payments')
    .select(PAYMENT_SELECT)
    .eq('merchant_id', merchantId)
    .eq('merchant_order_id', validated.orderId)
    .eq('mode', mode)
    .maybeSingle();

  if (existingRow) {
    const existing = existingRow as PaymentRow;

    if (existing.status === 'cancelled') {
      return fail(409, 'payment_cancelled', 'Peman sa a te anile. Sèvi ak yon lòt `order_id`.');
    }

    if (existing.status === 'paid') {
      return {
        ok: true,
        idempotent: true,
        payment: toPaymentResource(existing, null),
      };
    }

    const stillValid =
      existing.status === 'pending' &&
      (existing.moncash_token || checkoutModeOf(existing) === 'ussd') &&
      (!existing.expires_at || new Date(existing.expires_at).getTime() > Date.now());

    if (stillValid) {
      return {
        ok: true,
        idempotent: true,
        payment: toPaymentResource(existing, checkoutUrlFor(existing)),
      };
    }

    // Peman ekspire oswa echwe: bay li yon nouvo lyen checkout
    return regeneratePayment(admin, existing, {
      merchantId,
      mode,
      fees,
      settings,
      validated,
    });
  }

  const monthlyCheck = await checkMonthlyLimit(
    admin,
    merchantId,
    mode,
    validated.amount,
    account,
    settings
  );
  if (!monthlyCheck.ok) {
    return fail(monthlyCheck.status, monthlyCheck.code, monthlyCheck.message);
  }

  if (mode === 'live') {
    const daily = await checkMerchantDailyReceive(admin, merchantId, validated.amount);
    if (!daily.ok) {
      return fail(409, daily.code, PAYER_LIMIT_MESSAGE);
    }
  }

  const gatewayOrderId = newGatewayOrderId(mode);
  const expiresAt = new Date(
    Date.now() + Math.max(settings.payment_link_ttl_minutes, 1) * 60_000
  ).toISOString();

  const { data: inserted, error: insertErr } = await admin
    .from('hatex_payments')
    .insert({
      merchant_id: merchantId,
      api_key_id: apiKeyId,
      mode,
      merchant_order_id: validated.orderId,
      gateway_order_id: gatewayOrderId,
      merchant_amount: fees.merchantAmount,
      platform_fee: fees.platformFee,
      payout_fee: fees.payoutFee,
      client_total: fees.clientTotal,
      status: 'pending',
      payer_phone: validated.customerPhone,
      return_url: validated.returnUrl,
      description: validated.description,
      metadata: validated.metadata as never,
      expires_at: expiresAt,
    })
    .select(PAYMENT_SELECT)
    .maybeSingle();

  if (insertErr) {
    // Kous ant de demann ak menm order_id: repran sa ki genyen an
    if (insertErr.code === '23505') {
      const { data: raced } = await admin
        .from('hatex_payments')
        .select(PAYMENT_SELECT)
        .eq('merchant_id', merchantId)
        .eq('merchant_order_id', validated.orderId)
        .eq('mode', mode)
        .maybeSingle();

      if (raced) {
        const row = raced as PaymentRow;
        return {
          ok: true,
          idempotent: true,
          payment: toPaymentResource(row, checkoutUrlFor(row)),
        };
      }
    }
    return fail(500, 'storage_error', insertErr.message);
  }

  if (!inserted) {
    return fail(500, 'storage_error', 'Pa t kapab sere peman an.');
  }

  return attachCheckout(admin, inserted as PaymentRow, fees.clientTotal, validated.flow);
}

/** Bay yon peman ki ekspire/echwe yon nouvo referans ak yon nouvo lyen. */
async function regeneratePayment(
  admin: SupabaseClient,
  existing: PaymentRow,
  ctx: {
    merchantId: string;
    mode: GatewayMode;
    fees: NonNullable<ReturnType<typeof computeFees>>;
    settings: Awaited<ReturnType<typeof getGatewaySettings>>;
    validated: {
      amount: number;
      description: string | null;
      returnUrl: string | null;
      customerPhone: string | null;
      flow: MonCashFlowMode;
      metadata: Record<string, unknown> | null;
    };
  }
): Promise<CreatePaymentResult> {
  const gatewayOrderId = newGatewayOrderId(ctx.mode);
  const expiresAt = new Date(
    Date.now() + Math.max(ctx.settings.payment_link_ttl_minutes, 1) * 60_000
  ).toISOString();

  const { data: updated, error } = await admin
    .from('hatex_payments')
    .update({
      gateway_order_id: gatewayOrderId,
      merchant_amount: ctx.fees.merchantAmount,
      platform_fee: ctx.fees.platformFee,
      payout_fee: ctx.fees.payoutFee,
      client_total: ctx.fees.clientTotal,
      status: 'pending',
      moncash_token: null,
      payer_phone: ctx.validated.customerPhone,
      return_url: ctx.validated.returnUrl,
      description: ctx.validated.description,
      metadata: ctx.validated.metadata as never,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .not('status', 'eq', 'paid')
    .select(PAYMENT_SELECT)
    .maybeSingle();

  if (error) return fail(500, 'storage_error', error.message);

  if (!updated) {
    // Li vin peye ant tan an — retounen sa ki nan baz la
    const { data: fresh } = await admin
      .from('hatex_payments')
      .select(PAYMENT_SELECT)
      .eq('id', existing.id)
      .maybeSingle();
    if (fresh) {
      return { ok: true, idempotent: true, payment: toPaymentResource(fresh as PaymentRow, null) };
    }
    return fail(500, 'storage_error', 'Pa t kapab mete peman an ajou.');
  }

  return attachCheckout(admin, updated as PaymentRow, ctx.fees.clientTotal, ctx.validated.flow);
}

/**
 * Rele MonCash pou jwenn token checkout la (oswa voye USSD dirèk si flow la
 * mande l epi API Digicel la konfigire) epi sere l.
 */
async function attachCheckout(
  admin: SupabaseClient,
  row: PaymentRow,
  clientTotal: number,
  flow: MonCashFlowMode
): Promise<CreatePaymentResult> {
  const cfg = getMonCashConfigForGateway(row.mode);

  let checkoutMode: 'hosted' | 'ussd' = 'hosted';
  let ussdReference: string | null = null;

  const markFailed = async () => {
    await admin
      .from('hatex_payments')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'pending');
  };

  if (flow !== 'redirect') {
    const attempt = await attemptMonCashUssdPush({
      cfg,
      flow,
      phone: row.payer_phone,
      amount: clientTotal,
      orderId: row.gateway_order_id,
      description: row.description,
      reference: row.merchant_order_id,
    });
    if (attempt.ok) {
      checkoutMode = 'ussd';
      ussdReference = attempt.reference;
    } else if (flow === 'ussd') {
      await markFailed();
      const code =
        attempt.code === 'invalid_phone'
          ? 'customer_phone_required'
          : attempt.code === 'not_configured'
            ? 'ussd_push_not_configured'
            : 'ussd_push_failed';
      return fail(
        attempt.code === 'not_configured' ? 503 : attempt.code === 'invalid_phone' ? 400 : 502,
        code,
        attempt.message
      );
    }
    // flow 'auto' + pa konfigire → tonbe sou mòd hosted (fallback) anba a.
  }

  let created: Awaited<ReturnType<typeof createMonCashPayment>> | null = null;
  if (checkoutMode === 'hosted') {
    created = await createMonCashPayment(row.gateway_order_id, clientTotal, cfg);
    if (!created.ok) {
      await markFailed();
      return fail(502, 'provider_error', `MonCash refize peman an: ${created.message}`);
    }
  }

  const prevMetadata =
    row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const enrichedMetadata = flowMetadata(flow, ussdReference, prevMetadata);

  const { data: withToken } = await admin
    .from('hatex_payments')
    .update({
      moncash_token: created?.data.token ?? null,
      metadata: enrichedMetadata as never,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select(PAYMENT_SELECT)
    .maybeSingle();

  const finalRow =
    (withToken as PaymentRow) || {
      ...row,
      moncash_token: created?.data.token ?? null,
      metadata: enrichedMetadata,
    };

  return {
    ok: true,
    idempotent: false,
    payment: toPaymentResource(finalRow, created?.data.redirectUrl ?? null),
  };
}
