import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findProfileByCard } from '@/lib/security/card-lookup';
import { checkSpendingLimit, checkBalanceCap, checkApiReceiveLimit, calcApiReceiveFee } from '@/lib/security/spending-limits';
import { deliverWebhookEvent } from '@/lib/security/webhook-delivery';
import { authenticateMerchantApiKey } from '@/lib/security/api-key';
import {
  CLIENT_PAYMENT_PROFILE_SELECT,
  balanceDiagnosticsFromBalances,
  validateClientForCardPayment,
} from '@/lib/security/client-payment-balance';
import {
  claimIdempotencyKey,
  finalizeIdempotencyKey,
  isUntrustedBrowserRequest,
  merchantApiJson,
  MERCHANT_API_SECURITY_HEADERS,
  parseBearerApiKey,
  rateLimitCardPaymentAttempts,
  rateLimitInvalidApiKey,
  rateLimitMerchantApiKey,
  rateLimitMerchantIp,
  releaseIdempotencyKey,
} from '@/lib/security/merchant-api';
import { getClientIp } from '@/lib/security/rate-limit';

const API_BUILD_VERSION = '20260744-api-fee-v5';

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

function balanceDiagnostics(
  balances: { card_balance: number; wallet_balance: number },
  amount: number,
  debitFrom?: 'card' | 'wallet'
) {
  return {
    ...balanceDiagnosticsFromBalances(balances, amount),
    debit_from: debitFrom,
    build: API_BUILD_VERSION,
  };
}

/** Tcheke si nouvo kòd la sou Vercel (san otantifikasyon). */
export async function GET() {
  return jsonWithBuild({
    ok: true,
    build: API_BUILD_VERSION,
    hint: 'Si build pa egal 20260744-api-fee-v5, Vercel poko deploy dènye commit la.',
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
    const { amount, currency, order_id, card_info } = body;

    const cleanCard = String(card_info?.number || '').replace(/\D/g, '');
    const cleanCvv = String(card_info?.cvv || '').replace(/\D/g, '');
    const rawExp = String(card_info?.exp || '').replace(/\D/g, '');
    const safeAmount = parseFloat(Number(amount).toFixed(2));
    const cleanOrderId = String(order_id || '').trim().substring(0, 50);

    if (cleanCard.length < 15 || cleanCvv.length < 3 || rawExp.length !== 4 || isNaN(safeAmount) || safeAmount <= 0) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild({ error: 'Fòma done yo pa bon. Tcheke kat la, CVV a, Dat la (MMYY), oswa kantite kòb la.' }, 400);
    }

    const cardRl = await rateLimitCardPaymentAttempts(cleanCard);
    if (!cardRl.allowed) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild(
        { error: `Twòp tantativ sou kat sa a. Eseye ankò nan ${Math.ceil((cardRl.retryAfterSec || 900) / 60)} minit.` },
        429
      );
    }

    const slashedExp = `${rawExp.slice(0, 2)}/${rawExp.slice(2)}`;

    if (cleanOrderId && cleanOrderId !== 'N/A') {
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', merchant.id)
        .like('description', `%Kòmand #${cleanOrderId}%`)
        .single();

      if (existingTx) {
        if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
        return jsonWithBuild({ error: 'Peman sa a fèt deja pou kòmand sa a (Pwoteksyon Anti-Doublon).' }, 409);
      }
    }

    const { profile: client, error: cardError } = await findProfileByCard(
      supabase,
      cleanCard,
      cleanCvv,
      rawExp,
      slashedExp
    );

    if (!client) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild({ error: cardError || 'Tranzaksyon refize. Enfòmasyon kat yo pa koresponn.' }, 401);
    }

    const { data: freshClient, error: freshClientErr } = await supabase
      .from('profiles')
      .select(CLIENT_PAYMENT_PROFILE_SELECT)
      .eq('id', client.id)
      .single();

    if (freshClientErr || !freshClient) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild({ error: 'Pa kapab verifye balans kliyan an.' }, 500);
    }

    const paymentCheck = validateClientForCardPayment(freshClient, safeAmount);
    if (!paymentCheck.ok) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild(
        {
          error: paymentCheck.error,
          ...(paymentCheck.balances
            ? { balances: balanceDiagnostics(paymentCheck.balances, safeAmount) }
            : {}),
        },
        paymentCheck.status
      );
    }

    const clientBalances = paymentCheck.balances;

    if (freshClient.id === merchant.id) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild({
        error: 'Ou pa ka itilize menm kont pou machann ak kliyan. Itilize yon lòt kont kòm kliyan pou teste API a.',
      }, 400);
    }

    const limitCheck = await checkSpendingLimit(supabase, freshClient.id, freshClient.account_type, safeAmount, 'card');
    if (!limitCheck.allowed) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      return jsonWithBuild({ error: limitCheck.message || 'Limit depans depase.' }, 400);
    }

    const { fee: apiFee, net: merchantNet } = calcApiReceiveFee(safeAmount);

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

    const { data: rpcResult, error: rpcError } = await supabase.rpc('process_direct_card_payment', {
      p_client_id: freshClient.id,
      p_merchant_id: merchant.id,
      p_amount: safeAmount,
      p_order_id: cleanOrderId || 'N/A',
      p_client_name: freshClient.full_name,
      p_merchant_name: merchant.full_name,
      p_daily_received_so_far: receiveCheck.todayReceived,
    });

    if (rpcError || !rpcResult?.success) {
      if (idempotencyKey) await releaseIdempotencyKey(supabase, merchant.id, idempotencyKey);
      const status = rpcResult?.duplicate ? 409 : 400;
      const rpcMessage = rpcResult?.message || rpcError?.message || 'Echèk nan egzekisyon peman an.';
      return jsonWithBuild(
        {
          error: rpcMessage,
          balances: balanceDiagnostics(clientBalances, safeAmount, paymentCheck.debitFrom),
        },
        status
      );
    }

    const transactionId: string = rpcResult.transaction_id;

    const successResponse = {
      success: true,
      message: 'Peman an fèt ak siksè!',
      transaction_id: transactionId,
      customer: freshClient.full_name,
      amount_charged: safeAmount,
      amount_received: rpcResult.net_amount ?? merchantNet,
      api_fee: rpcResult.api_fee ?? apiFee,
      api_fee_percent: 3,
      debited_from: rpcResult.debited_from || paymentCheck.debitFrom,
    };

    if (idempotencyKey) {
      await finalizeIdempotencyKey(supabase, merchant.id, idempotencyKey, successResponse);
    }

    await deliverWebhookEvent(supabase, merchant.id, 'payment.success', {
      transaction_id: transactionId,
      order_id: cleanOrderId || 'N/A',
      amount: safeAmount,
      amount_received: rpcResult.net_amount ?? merchantNet,
      api_fee: rpcResult.api_fee ?? apiFee,
      currency: currency || 'HTG',
      customer_name: freshClient.full_name,
    });

    return jsonWithBuild(successResponse);
  } catch (error: unknown) {
    console.error('[CRITICAL ERROR] HatexCard Payment Gateway:', error);
    if (idempotencyKey && merchantId) {
      try {
        await releaseIdempotencyKey(supabase, merchantId, idempotencyKey);
      } catch {
        /* ignore cleanup failure */
      }
    }
    return NextResponse.json(
      { error: 'Sèvè a rankontre yon erè kritik. Tanpri kontakte sipò HatexCard.' },
      { status: 500, headers: MERCHANT_API_SECURITY_HEADERS }
    );
  }
}
