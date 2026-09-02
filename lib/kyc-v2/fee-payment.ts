import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMonCashPayment } from '@/lib/moncash/client';
import {
  getMonCashConfigForGateway,
  getMonCashMode,
  type GatewayMode,
} from '@/lib/moncash/config';
import { getGatewaySettings, resolveKycFeeHtg } from '@/lib/moncash/settings';
import { evaluateReadiness, describeMissingDocuments, markApplicationSubmitted, type KycApplication } from './application';

/**
 * Frè KYC a pase sou MonCash — pa gen wòlèt nan v2, donk pa gen balans pou
 * debite. Peman an sere kòm yon `hatex_payments` ak `purpose = 'kyc_fee'`,
 * sa ki fè règleman an konnen li pa dwe kreye yon payout: tout montan an se
 * revni HatexCard.
 *
 * Dosye a soumèt SÈLMAN lè peman an konfime (gade `lib/moncash/settle.ts`).
 */

/**
 * Mòd peman frè a swiv mòd platfòm la: an devlopman nou pale ak sandbox, an
 * pwodiksyon ak MonCash live. Konsa tès lokal yo mache san vre lajan.
 */
function feePaymentMode(): GatewayMode {
  return getMonCashMode() === 'live' ? 'live' : 'test';
}

export type FeePaymentResult =
  | {
      ok: true;
      checkoutUrl: string;
      paymentId: string;
      amount: number;
      reference: string;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };

export async function createKycFeePayment(
  admin: SupabaseClient,
  app: KycApplication,
  options: { returnUrl?: string } = {}
): Promise<FeePaymentResult> {
  if (app.status !== 'draft') {
    return {
      ok: false,
      status: 409,
      code: 'not_draft',
      message: 'Dosye ou deja soumèt. Pa gen anyen pou peye.',
    };
  }

  if (app.fee_paid) {
    return {
      ok: false,
      status: 409,
      code: 'already_paid',
      message: 'Frè a deja peye.',
    };
  }

  // Pa kite moun peye pou yon dosye ki pa konplè — li t ap bloke apre peman an
  const readiness = await evaluateReadiness(admin, app);
  if (!readiness.ready) {
    const parts: string[] = [];
    if (Object.keys(readiness.missingFields).length > 0) {
      parts.push('gen chan ki poko ranpli');
    }
    if (readiness.missingDocuments.length > 0) {
      parts.push(`dokiman ki manke: ${describeMissingDocuments(readiness.missingDocuments)}`);
    }
    if (!readiness.livenessDone) parts.push('verifikasyon figi a poko fèt');

    return {
      ok: false,
      status: 409,
      code: 'application_incomplete',
      message: `Dosye a poko konplè — ${parts.join('; ')}.`,
      details: {
        missing_fields: readiness.missingFields,
        missing_documents: readiness.missingDocuments,
        liveness_done: readiness.livenessDone,
      },
    };
  }

  const mode = feePaymentMode();

  let cfg;
  try {
    cfg = getMonCashConfigForGateway(mode);
  } catch (err) {
    return {
      ok: false,
      status: 503,
      code: 'gateway_unavailable',
      message: err instanceof Error ? err.message : 'MonCash pa disponib kounye a.',
    };
  }

  const settings = await getGatewaySettings(admin);
  const amount = resolveKycFeeHtg(settings, app.account_type);

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      status: 500,
      code: 'fee_misconfigured',
      message: 'Frè KYC a pa konfigire kòrèkteman. Kontakte sipò.',
    };
  }

  // Idempotans: yon sèl liy peman frè pa dosye. Token MonCash la mouri an
  // ~3 minit — nou pa janm reyitilize yon lyen ki deja louvri, sinon bouton
  // an di "session expired". Chak klike Peye kreye yon nouvo sesyon.
  const merchantOrderId = `kyc_${app.id}`;
  const gatewayOrderId = `hxk_${crypto.randomBytes(14).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 3 * 60_000).toISOString();

  const { data: existing } = await admin
    .from('hatex_payments')
    .select('id, status, gateway_order_id, moncash_token, expires_at')
    .eq('merchant_id', app.user_id)
    .eq('merchant_order_id', merchantOrderId)
    .eq('mode', mode)
    .maybeSingle();

  if (existing?.status === 'paid') {
    return {
      ok: false,
      status: 409,
      code: 'already_paid',
      message: 'Frè a deja peye.',
    };
  }

  const row = {
    merchant_id: app.user_id,
    mode,
    purpose: 'kyc_fee',
    merchant_order_id: merchantOrderId,
    gateway_order_id: gatewayOrderId,
    merchant_amount: 0,
    platform_fee: amount,
    payout_fee: 0,
    client_total: amount,
    status: 'pending',
    moncash_token: null,
    description: `Frè verifikasyon KYC — ${app.account_type === 'business' ? 'kont biznis' : 'kont endividyèl'}`,
    return_url: options.returnUrl || null,
    metadata: { kyc_application_id: app.id } as never,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };

  const paymentId = existing?.id;
  const { data: saved, error: saveErr } = paymentId
    ? await admin
        .from('hatex_payments')
        .update(row)
        .eq('id', paymentId)
        .not('status', 'eq', 'paid')
        .select('id, gateway_order_id')
        .maybeSingle()
    : await admin.from('hatex_payments').insert(row).select('id, gateway_order_id').maybeSingle();

  if (saveErr) {
    return { ok: false, status: 500, code: 'storage_error', message: saveErr.message };
  }
  if (!saved) {
    return {
      ok: false,
      status: 409,
      code: 'already_paid',
      message: 'Frè a sanble deja peye. Rafrechi paj la.',
    };
  }

  const created = await createMonCashPayment(saved.gateway_order_id, amount, cfg);

  if (!created.ok) {
    await admin
      .from('hatex_payments')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', saved.id)
      .eq('status', 'pending');

    return {
      ok: false,
      status: 502,
      code: 'provider_error',
      message: `MonCash pa t kapab kreye peman an: ${created.message}`,
    };
  }

  await admin
    .from('hatex_payments')
    .update({ moncash_token: created.data.token, updated_at: new Date().toISOString() })
    .eq('id', saved.id);

  return {
    ok: true,
    paymentId: saved.id,
    amount,
    reference: saved.gateway_order_id,
    checkoutUrl: created.data.redirectUrl,
  };
}

export type SimulatedFeeResult =
  | { ok: true; paymentId: string; amount: number }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };

/**
 * Sandbox sèlman: kont machann tès MonCash la souvan rive nan "Maximum
 * account balance" epi Transfert pa aktif pou vide l. Sa pèmèt fini tès
 * KYC la san vre bouton. Pa janm mache sou live.
 */
export async function simulateSandboxKycFee(
  admin: SupabaseClient,
  app: KycApplication
): Promise<SimulatedFeeResult> {
  if (getMonCashMode() === 'live') {
    return {
      ok: false,
      status: 403,
      code: 'not_sandbox',
      message: 'Similasyon peman an pa disponib sou MonCash live.',
    };
  }

  if (app.status !== 'draft') {
    return {
      ok: false,
      status: 409,
      code: 'not_draft',
      message: 'Dosye ou deja soumèt.',
    };
  }

  if (app.fee_paid) {
    return { ok: true, paymentId: app.fee_payment_id || app.id, amount: Number(app.fee_amount || 0) };
  }

  const readiness = await evaluateReadiness(admin, app);
  if (!readiness.ready) {
    return {
      ok: false,
      status: 409,
      code: 'application_incomplete',
      message: 'Dosye a poko konplè.',
    };
  }

  const mode = feePaymentMode();
  const settings = await getGatewaySettings(admin);
  const amount = resolveKycFeeHtg(settings, app.account_type);
  const merchantOrderId = `kyc_${app.id}`;
  const gatewayOrderId = `hxk_${crypto.randomBytes(14).toString('hex')}`;
  const now = new Date().toISOString();
  const fakeTx = `sim_${crypto.randomBytes(10).toString('hex')}`;

  const { data: existing } = await admin
    .from('hatex_payments')
    .select('id, status')
    .eq('merchant_id', app.user_id)
    .eq('merchant_order_id', merchantOrderId)
    .eq('mode', mode)
    .maybeSingle();

  if (existing?.status === 'paid') {
    await markApplicationSubmitted(admin, app.id, existing.id, amount);
    return { ok: true, paymentId: existing.id, amount };
  }

  const row = {
    merchant_id: app.user_id,
    mode,
    purpose: 'kyc_fee',
    merchant_order_id: merchantOrderId,
    gateway_order_id: gatewayOrderId,
    merchant_amount: 0,
    platform_fee: amount,
    payout_fee: 0,
    client_total: amount,
    status: 'paid',
    moncash_token: null,
    moncash_transaction_id: fakeTx,
    description: 'Frè KYC — similasyon sandbox',
    metadata: { kyc_application_id: app.id, simulated: true } as never,
    paid_at: now,
    expires_at: now,
    updated_at: now,
  };

  const { data: saved, error: saveErr } = existing?.id
    ? await admin
        .from('hatex_payments')
        .update(row)
        .eq('id', existing.id)
        .not('status', 'eq', 'paid')
        .select('id')
        .maybeSingle()
    : await admin.from('hatex_payments').insert(row).select('id').maybeSingle();

  if (saveErr) {
    return { ok: false, status: 500, code: 'storage_error', message: saveErr.message };
  }
  if (!saved) {
    return { ok: false, status: 409, code: 'already_paid', message: 'Frè a deja peye.' };
  }

  const submitted = await markApplicationSubmitted(admin, app.id, saved.id, amount);
  if (!submitted.ok) {
    return {
      ok: false,
      status: 500,
      code: 'submit_failed',
      message: submitted.message || 'Pa t kapab soumèt dosye a.',
    };
  }

  return { ok: true, paymentId: saved.id, amount };
}
