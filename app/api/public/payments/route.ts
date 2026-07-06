import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findProfileByCard } from '@/lib/security/card-lookup';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { checkSpendingLimit, checkBalanceCap, checkApiReceiveLimit } from '@/lib/security/spending-limits';
import { deliverWebhookEvent } from '@/lib/security/webhook-delivery';
import { authenticateMerchantApiKey } from '@/lib/security/api-key';
import {
  CLIENT_PAYMENT_PROFILE_SELECT,
  balanceDiagnosticsFromBalances,
  validateClientForCardPayment,
} from '@/lib/security/client-payment-balance';

const API_BUILD_VERSION = '20260722-card-balance-v3';

function jsonWithBuild(body: Record<string, unknown>, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: {
      'X-Hatex-Api-Version': API_BUILD_VERSION,
      ...(extraHeaders || {}),
    },
  });
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
    hint: 'Si build pa egal 20260722-card-balance-v3, Vercel poko deploy dènye commit la.',
  });
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimit(`public-payments:${ip}`, 40, 60);
    if (!rl.allowed) {
      return jsonWithBuild({ error: 'Twòp demann. Eseye ankò.' }, 429);
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonWithBuild({ error: 'Aksè refize. Kle API (Bearer Token) manke oswa li pa fòmate byen.' }, 401);
    }

    const apiKey = authHeader.split(' ')[1].trim();
    const idempotencyKey = (request.headers.get('idempotency-key') || request.headers.get('Idempotency-Key') || '').trim().slice(0, 200);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const merchant = await authenticateMerchantApiKey(supabase, apiKey);

    if (!merchant || !merchant.is_merchant) {
      return jsonWithBuild({ error: 'Kle API sa a pa valab oswa kont lan pa otorize pou resevwa peman.' }, 403);
    }
    if (merchant.account_status !== 'active') {
      return jsonWithBuild({ error: 'Kont machann sa a pa aktif. Tranzaksyon an anile.' }, 403);
    }

    if (idempotencyKey) {
      const { data: existingIdem } = await supabase
        .from('api_idempotency_keys')
        .select('response_body')
        .eq('merchant_id', merchant.id)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingIdem?.response_body) {
        return jsonWithBuild(existingIdem.response_body as Record<string, unknown>, 200, { 'Idempotent-Replayed': 'true' });
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
      return jsonWithBuild({ error: 'Fòma done yo pa bon. Tcheke kat la, CVV a, Dat la (MMYY), oswa kantite kòb la.' }, 400);
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
      return jsonWithBuild({ error: cardError || 'Tranzaksyon refize. Enfòmasyon kat yo pa koresponn.' }, 401);
    }

    const { data: freshClient, error: freshClientErr } = await supabase
      .from('profiles')
      .select(CLIENT_PAYMENT_PROFILE_SELECT)
      .eq('id', client.id)
      .single();

    if (freshClientErr || !freshClient) {
      return jsonWithBuild({ error: 'Pa kapab verifye balans kliyan an (profiles.card_balance).' }, 500);
    }

    const paymentCheck = validateClientForCardPayment(freshClient, safeAmount);
    if (!paymentCheck.ok) {
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
      return jsonWithBuild({
        error: 'Ou pa ka itilize menm kont pou machann ak kliyan. Itilize yon lòt kont kòm kliyan pou teste API a.',
      }, 400);
    }

    const limitCheck = await checkSpendingLimit(supabase, freshClient.id, freshClient.account_type, safeAmount, 'card');
    if (!limitCheck.allowed) {
      return jsonWithBuild({ error: limitCheck.message || 'Limit depans depase.' }, 400);
    }

    const capCheck = checkBalanceCap(Number(merchant.wallet_balance || 0), merchant.account_type, safeAmount);
    if (!capCheck.allowed) {
      return jsonWithBuild({ error: capCheck.message || 'Balans machann nan ta depase limit maksimòm otorize a.' }, 400);
    }

    const receiveCheck = await checkApiReceiveLimit(supabase, merchant.id, merchant.account_type, safeAmount);
    if (!receiveCheck.allowed) {
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
      const status = rpcResult?.duplicate ? 409 : 400;
      const rpcMessage = rpcResult?.message || rpcError?.message || 'Echèk nan egzekisyon peman an.';
      const errBody: Record<string, unknown> = {
        error: rpcMessage,
        balances: balanceDiagnostics(clientBalances, safeAmount, paymentCheck.debitFrom),
      };
      if (rpcMessage === 'Fon ensifizan.') {
        errBody.hint =
          'Ansyen RPC Supabase toujou sou live (li tcheke wallet_balance, pa card_balance). ' +
          'Kouri migrasyon 20260721 sou Supabase epi redeploy Vercel (npm run verify:live).';
      }
      return jsonWithBuild(errBody, status);
    }

    const transactionId: string = rpcResult.transaction_id;

    const successResponse = {
      success: true,
      message: 'Peman an fèt ak siksè!',
      transaction_id: transactionId,
      customer: freshClient.full_name,
      amount_charged: safeAmount,
      debited_from: rpcResult.debited_from || paymentCheck.debitFrom,
      balances: balanceDiagnostics(clientBalances, safeAmount, rpcResult.debited_from || paymentCheck.debitFrom),
    };

    if (idempotencyKey) {
      await supabase.from('api_idempotency_keys').insert({
        merchant_id: merchant.id,
        idempotency_key: idempotencyKey,
        response_body: successResponse,
      });
    }

    await deliverWebhookEvent(supabase, merchant.id, 'payment.success', {
      transaction_id: transactionId,
      order_id: cleanOrderId || 'N/A',
      amount: safeAmount,
      currency: currency || 'HTG',
      customer_name: freshClient.full_name,
    });

    return jsonWithBuild(successResponse);
  } catch (error: unknown) {
    console.error('[CRITICAL ERROR] HatexCard Payment Gateway:', error);
    return jsonWithBuild({ error: 'Sèvè a rankontre yon erè kritik. Tanpri kontakte sipò HatexCard.' }, 500);
  }
}
