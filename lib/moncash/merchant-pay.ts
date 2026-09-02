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
import {
  attemptIsReusable,
  findMerchantAttempt,
  insertAttempt,
  refreshAttempt,
} from '@/lib/moncash/attempts';
import { ensureProfileClientRef } from '@/lib/security/client-ref';

/**
 * Demare yon peman MonCash pou yon machann (QR checkout, API machann, elatriye).
 *
 * Prensip: KLIYAN an peye (montan + frè) sou MonCash. Machann nan resevwa montan
 * konplè li mande a sou kont li (payout) apre konfimasyon webhook / cron.
 */

export type StartMerchantMonCashInput = {
  merchantId: string;
  /** Montan machann nan mande a, an HTG. */
  amount: number;
  /** Referans kòmand machann nan (dwe inik pou li). */
  orderId: string;
  description?: string | null;
  returnUrl?: string | null;
  customerPhone?: string | null;
  /** 'auto' (default) | 'redirect' | 'ussd' */
  flow?: unknown;
  metadata?: Record<string, unknown> | null;
};

export type StartMerchantMonCashResult =
  | {
      ok: true;
      checkoutUrl: string | null;
      checkoutMode: 'hosted' | 'ussd';
      paymentId: string;
      mode: GatewayMode;
      clientTotal: number;
      reference: string;
    }
  | { ok: false; status: number; message: string };

export async function startMerchantMonCashPayment(
  admin: SupabaseClient,
  input: StartMerchantMonCashInput
): Promise<StartMerchantMonCashResult> {
  const { merchantId } = input;

  // Mòd Machann nan — baze sou api_key_mode li (default 'live').
  const { data: profile } = await admin
    .from('profiles')
    .select('api_key_mode, client_ref')
    .eq('id', merchantId)
    .maybeSingle();
  const mode: GatewayMode = profile?.api_key_mode === 'test' ? 'test' : 'live';

  // Referans opak machann nan — pou konnen kiyès k ap resevwa lajan an.
  const clientRef =
    typeof profile?.client_ref === 'string' && profile.client_ref
      ? profile.client_ref
      : await ensureProfileClientRef(admin, merchantId);

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

  const settings = await getGatewaySettings(admin);

  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, status: 400, message: 'Montan pa valab.' };
  }
  if (Number(settings.min_amount_per_tx_htg) > 0 && amount < Number(settings.min_amount_per_tx_htg)) {
    return {
      ok: false,
      status: 400,
      message: `Montan minimòm se ${Number(settings.min_amount_per_tx_htg).toLocaleString('fr-FR')} HTG.`,
    };
  }
  if (Number(settings.max_amount_per_tx_htg) > 0 && amount > Number(settings.max_amount_per_tx_htg)) {
    return {
      ok: false,
      status: 400,
      message: `Montan maksimòm se ${Number(settings.max_amount_per_tx_htg).toLocaleString('fr-FR')} HTG.`,
    };
  }

  const orderId = String(input.orderId || '').trim().slice(0, 64);
  if (!orderId) {
    return { ok: false, status: 400, message: 'Referans kòmand la manke (order_id).' };
  }

  const { data: acct } = await admin
    .from('hatex_merchant_accounts')
    .select('user_id, status, payout_provider, payout_phone')
    .eq('user_id', merchantId)
    .maybeSingle();

  if (!acct) {
    return {
      ok: false,
      status: 403,
      message: 'Kont machann nan pa konfigire. Konplete anrejistreman an sou Dashboard la.',
    };
  }
  if (acct.status === 'suspended' || acct.status === 'rejected') {
    return { ok: false, status: 403, message: 'Kont sa a sispann. Kontakte sipò HatexCard.' };
  }
  if (mode === 'live' && acct.status !== 'active') {
    return {
      ok: false,
      status: 403,
      message: 'Kont ou poko aktif pou peman live. Chwazi yon plan sou /plan.',
    };
  }
  if (mode === 'live' && !acct.payout_phone) {
    return {
      ok: false,
      status: 409,
      message: 'Mete yon nimewo MonCash pou payout anvan ou aksepte peman live.',
    };
  }

  const fees = computeFees(amount, settings);
  if (!fees) return { ok: false, status: 400, message: 'Montan pa valab.' };

  const daily = await checkMerchantDailyReceive(admin, merchantId, fees.merchantAmount);
  if (!daily.ok) {
    return { ok: false, status: 409, message: PAYER_LIMIT_MESSAGE };
  }

  // Idempotans: yon sèl tantativ "pending" pa (machann, order_id, mòd).
  const existing = await findMerchantAttempt(admin, merchantId, orderId, mode);

  if (existing?.status === 'paid') {
    return { ok: false, status: 409, message: 'Kòmand sa a deja peye.' };
  }

  if (existing && attemptIsReusable(existing)) {
    // Menm order_id rele ankò (API / paj reload) → menm sesyon an.
    if (existing.moncash_token) {
      return {
        ok: true,
        checkoutUrl: `${cfg.gatewayBase}/Payment/Redirect?token=${encodeURIComponent(
          existing.moncash_token
        )}`,
        checkoutMode: 'hosted' as const,
        paymentId: existing.id,
        mode,
        clientTotal: fees.clientTotal,
        reference: existing.gateway_order_id || orderId,
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
        mode,
        clientTotal: fees.clientTotal,
        reference: existing.gateway_order_id || orderId,
      };
    }
  }

  const gatewayOrderId = `hx${mode === 'live' ? 'l' : 't'}_${crypto.randomBytes(16).toString('hex')}`;
  const expiresAt = new Date(
    Date.now() + Math.max(Number(settings.payment_link_ttl_minutes) || 15, 1) * 60_000
  ).toISOString();

  const flow = parseMonCashFlow(input.flow);
  const customerPhone = normalizeMonCashPhone(input.customerPhone);
  const description = input.description ? String(input.description).trim().slice(0, 200) : null;

  let checkoutMode: 'hosted' | 'ussd' = 'hosted';
  let ussdReference: string | null = null;

  // Mòd USSD dirèk: eseye voye USSD sou telefòn kliyan an (lè Digicel API aktif).
  if (flow !== 'redirect') {
    const attempt = await attemptMonCashUssdPush({
      cfg,
      flow,
      phone: customerPhone,
      amount: fees.clientTotal,
      orderId: gatewayOrderId,
      description,
      reference: orderId,
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
    created = await createMonCashPayment(gatewayOrderId, fees.clientTotal, cfg);
    if (!created.ok) {
      return { ok: false, status: 502, message: created.message };
    }
  }

  const baseMeta =
    input.metadata && typeof input.metadata === 'object'
      ? (input.metadata as Record<string, unknown>)
      : {};
  const receiverMeta: Record<string, unknown> = { ...baseMeta };
  if (clientRef) receiverMeta.receiver_ref = clientRef;
  const metadata = flowMetadata(flow, ussdReference, receiverMeta);
  const values = {
    api_key_id: null,
    merchant_amount: fees.merchantAmount,
    platform_fee: fees.platformFee,
    payout_fee: fees.payoutFee,
    client_total: fees.clientTotal,
    moncash_token: created?.data.token ?? null,
    payer_phone: customerPhone,
    description,
    return_url: input.returnUrl ? String(input.returnUrl).slice(0, 500) : null,
    metadata,
  };

  const attemptResult = existing
    ? await refreshAttempt(admin, merchantId, orderId, mode, existing, {
        gateway_order_id: gatewayOrderId,
        expires_at: expiresAt,
        ...values,
      })
    : await insertAttempt(admin, {
        merchant_id: merchantId,
        merchant_order_id: orderId,
        gateway_order_id: gatewayOrderId,
        purpose: 'merchant',
        mode,
        expires_at: expiresAt,
        ...values,
      });

  if (!attemptResult.ok) {
    return { ok: false, status: attemptResult.status, message: attemptResult.message };
  }

  // Kous la te rale yon liy ki deja peye → pa janm bay yon nouvo sesyon.
  if (attemptResult.row.status === 'paid') {
    return { ok: false, status: 409, message: 'Kòmand sa a deja peye.' };
  }

  return {
    ok: true,
    checkoutUrl: created?.data.redirectUrl ?? null,
    checkoutMode,
    paymentId: attemptResult.row.id,
    mode,
    clientTotal: fees.clientTotal,
    reference: attemptResult.row.gateway_order_id || gatewayOrderId,
  };
}
