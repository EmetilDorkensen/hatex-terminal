import { createClient } from '@supabase/supabase-js';
import { checkBalanceCap, checkApiReceiveLimit, calcApiReceiveFee } from '@/lib/security/spending-limits';
import { resolvePlatformFee } from '@/lib/fees/platform';
import { authenticateMerchantApiKey } from '@/lib/security/api-key';
import {
  claimIdempotencyKey,
  finalizeIdempotencyKey,
  isUntrustedBrowserRequest,
  merchantApiJson,
  parseBearerApiKey,
  rateLimitInvalidApiKey,
  rateLimitMerchantApiKey,
  rateLimitMerchantIp,
  releaseIdempotencyKey,
} from '@/lib/security/merchant-api';
import { getClientIp } from '@/lib/security/rate-limit';
import { createMonCashPayment } from '@/lib/moncash/client';
import { getMonCashConfigForGateway } from '@/lib/moncash/config';
import { computeFees } from '@/lib/moncash/fees';
import { getGatewaySettings } from '@/lib/moncash/settings';

const API_BUILD_VERSION = '20260911-no-virtual-card';

function jsonWithBuild(body: Record<string, unknown>, status = 200, extraHeaders?: Record<string, string>) {
  return merchantApiJson(
    body,
    status,
    {
      'X-Hatex-Api-Version': API_BUILD_VERSION,
      ...(extraHeaders || {}),
    }
  );
}

/** Tcheke si nouvo kòd la sou Vercel (san otantifikasyon). */
export async function GET() {
  return jsonWithBuild({
    ok: true,
    build: API_BUILD_VERSION,
    hint: 'Si build pa egal 20260911-no-virtual-card, Vercel poko deploy dènye commit la.',
  });
}

export async function POST(request: Request) {
  let idempotencyKey = '';
  let merchantId: string | null = null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    if (isUntrustedBrowserRequest(request)) {
      return jsonWithBuild(
        {
          error:
            'API sa a se sèlman pou sèvè machann (PHP/Node/Python). Pa rele l depi navigatè kliyan an.',
        },
        403
      );
    }

    const ipRl = await rateLimitMerchantIp(request, 'public-payments', 30, 60);
    if (!ipRl.allowed) {
      return jsonWithBuild({ error: 'Twòp demann. Eseye ankò.' }, 429);
    }

    const apiKey = parseBearerApiKey(request);
    if (!apiKey) {
      return jsonWithBuild({ error: 'Aksè refize. Kle API (Bearer Token) manke oswa li pa fòmate byen.' }, 401);
    }

    idempotencyKey = (request.headers.get('idempotency-key') || request.headers.get('Idempotency-Key') || '')
      .trim()
      .slice(0, 200);

    const keyRl = await rateLimitMerchantApiKey(apiKey, 120, 60);
    if (!keyRl.allowed) {
      return jsonWithBuild({ error: 'Twòp demann pou kle API sa a. Eseye ankò.' }, 429);
    }

    const merchant = await authenticateMerchantApiKey(supabase, apiKey);

    if (!merchant || !merchant.is_merchant) {
      const badKeyRl = await rateLimitInvalidApiKey(getClientIp(request));
      if (!badKeyRl.allowed) {
        return jsonWithBuild({ error: 'Twòp tantativ ak kle envalid. Eseye ankò.' }, 429);
      }
      return jsonWithBuild({ error: 'Kle API sa a pa valab oswa kont lan pa otorize pou resevwa peman.' }, 403);
    }
    if (merchant.account_status !== 'active') {
      return jsonWithBuild({ error: 'Kont machann sa a pa aktif. Tranzaksyon an anile.' }, 403);
    }

    merchantId = merchant.id;

    if (idempotencyKey) {
      const claim = await claimIdempotencyKey(supabase, merchant.id, idempotencyKey);
      if (claim.status === 'replay') {
        return jsonWithBuild(claim.body, 200, { 'Idempotent-Replayed': 'true' });
      }
      if (claim.status === 'in_progress') {
        return jsonWithBuild({ error: 'Peman ak menm Idempotency-Key deja an kou.' }, 409);
      }
    }

    const body = await request.json();
    const { amount, currency, order_id, payment_method } = body;

    const safeAmount = parseFloat(Number(amount).toFixed(2));
    const cleanOrderId = String(order_id || '').trim().substring(0, 50);
    const method = String(payment_method || 'moncash').toLowerCase().trim();

    if (method !== 'moncash') {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild(
        {
          error:
            'Peman ak kat vityèl HatexCard pa disponib ankò. Itilize payment_method: "moncash".',
        },
        410
      );
    }

    // ============================================================
    // MODE MONCASH — kliyan an peye sou MonCash, machann nan resevwa
    // ============================================================
    if (isNaN(safeAmount) || safeAmount <= 0) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild({ error: 'Kantite kòb la pa valab.' }, 400);
    }

    const apiFeePer1000 = await resolvePlatformFee(supabase, 'api_fee_per_1000', merchant.id);
    const { fee: apiFee, net: merchantNet } = calcApiReceiveFee(safeAmount, apiFeePer1000);

    const capCheck = checkBalanceCap(Number(merchant.wallet_balance || 0), merchant.account_type, merchantNet);
    if (!capCheck.allowed) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild({ error: capCheck.message || 'Balans machann nan ta depase limit maksimòm otorize a.' }, 400);
    }

    const receiveCheck = await checkApiReceiveLimit(supabase, merchant.id, merchant.account_type, safeAmount);
    if (!receiveCheck.allowed) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild({ error: receiveCheck.message || 'Limit resepsyon API depase.' }, 400);
    }

    const { checkMerchantDailyReceive } = await import('@/lib/billing/receive-limit');
    const { PAYER_LIMIT_MESSAGE } = await import('@/lib/billing/plans');
    const daily = await checkMerchantDailyReceive(supabase, merchant.id, safeAmount);
    if (!daily.ok) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild({ error: PAYER_LIMIT_MESSAGE }, 409);
    }

    // Kalkile frè yo (kliyan an peye frè anplis)
    const settings = await getGatewaySettings(supabase);
    const fees = computeFees(safeAmount, {
      platform_fee_percent: settings.platform_fee_percent,
      platform_fee_min_htg: settings.platform_fee_min_htg,
      payout_fee_percent: settings.payout_fee_percent,
      payout_fee_min_htg: settings.payout_fee_min_htg,
    });
    if (!fees) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild({ error: 'Kantite kòb la pa valab.' }, 400);
    }

    // Kreye yon orderId inik pou MonCash
    const monCashOrderId = `hx-${merchant.id.slice(0, 8)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Kreye peman MonCash la
    let cfg;
    try {
      cfg = getMonCashConfigForGateway(merchant.api_key_mode || 'test');
    } catch (err) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild({ error: err instanceof Error ? err.message : 'Konfigirasyon MonCash manke.' }, 500);
    }

    const created = await createMonCashPayment(monCashOrderId, fees.clientTotal, cfg);
    if (!created.ok) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild({ error: created.message || 'Pa kapab kreye peman MonCash.' }, 502);
    }

    // Sere peman an nan tab hatex_payments pou règleman an
    const { data: paymentRow, error: paymentErr } = await supabase
      .from('hatex_payments')
      .insert({
        merchant_id: merchant.id,
        mode: merchant.api_key_mode || 'test',
        status: 'pending',
        purpose: 'merchant',
        gateway_order_id: monCashOrderId,
        merchant_amount: fees.merchantAmount,
        platform_fee: fees.platformFee,
        client_total: fees.clientTotal,
        metadata: {
          order_id: cleanOrderId || 'N/A',
          api_fee: apiFee,
          merchant_net: merchantNet,
        },
      })
      .select('id')
      .single();

    if (paymentErr || !paymentRow) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild({ error: 'Pa kapab sere peman an.' }, 500);
    }

    const monCashResponse = {
      success: true,
      message: 'Peman MonCash kreye. Kliyan an dwe peye sou MonCash.',
      payment_method: 'moncash',
      redirect_url: created.data.redirectUrl,
      payment_token: created.data.token,
      order_id: cleanOrderId || 'N/A',
      gateway_order_id: monCashOrderId,
      amount: safeAmount,
      client_total: fees.clientTotal,
      platform_fee: fees.platformFee,
      payout_fee: fees.payoutFee,
      currency: currency || 'HTG',
    };

    if (idempotencyKey) {
      await finalizeIdempotencyKey(supabase, merchant.id, idempotencyKey, monCashResponse);
    }

    return jsonWithBuild(monCashResponse);
  } catch (error: unknown) {
    console.error('[CRITICAL ERROR] HatexCard Payment Gateway:', error);
    if (idempotencyKey && merchantId) {
      try {
        await releaseIdempotencyKey(supabase, merchantId, idempotencyKey);
      } catch {
        /* ignore cleanup failure */
      }
    }
    return jsonWithBuild(
      { error: 'Sèvè a rankontre yon erè kritik. Tanpri kontakte sipò HatexCard.' },
      500
    );
  }
}
