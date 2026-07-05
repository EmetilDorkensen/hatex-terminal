import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findProfileByCard } from '@/lib/security/card-lookup';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { checkSpendingLimit, checkBalanceCap, checkApiReceiveLimit } from '@/lib/security/spending-limits';
import { deliverWebhookEvent } from '@/lib/security/webhook-delivery';
import { authenticateMerchantApiKey } from '@/lib/security/api-key';
import {
  clientCanPayAmount,
  insufficientClientFundsMessage,
  normalizeClientBalances,
} from '@/lib/security/client-payment-balance';

const API_BUILD_VERSION = '20260721-balance-v2';

function isDebugSession(request: Request): boolean {
  return request.headers.get('x-debug-session-id') === '138d33';
}

function debugLog(location: string, message: string, data: Record<string, unknown>, hypothesisId: string) {
  // #region agent log
  fetch('http://127.0.0.1:7300/ingest/e9f1fe4c-b3fd-4eaf-84be-ae95b4331381', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '138d33' },
    body: JSON.stringify({
      sessionId: '138d33',
      location,
      message,
      data,
      hypothesisId,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function jsonWithBuild(body: Record<string, unknown>, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: {
      'X-Hatex-Api-Version': API_BUILD_VERSION,
      ...(extraHeaders || {}),
    },
  });
}

function balanceDiagnostics(balances: { card_balance: number; wallet_balance: number }, amount: number) {
  return {
    card_htg: balances.card_balance,
    wallet_htg: balances.wallet_balance,
    required_htg: amount,
    build: API_BUILD_VERSION,
  };
}

/** Tcheke si nouvo kòd la sou Vercel (san otantifikasyon). */
export async function GET() {
  return jsonWithBuild({
    ok: true,
    build: API_BUILD_VERSION,
    hint: 'Si build pa egal 20260721-balance-v2, Vercel poko deploy dènye commit la.',
  });
}

// 🔐 KOUCH SEKIRITE 1: PA GEN CORS OUVÈ
// Sa a se yon API SÈVÈ-A-SÈVÈ ki otantifye ak yon kle sekrè (Bearer api_key).
// Pa gen okenn rezon pou yon navigatè (browser) rele l dirèkteman ak kle sa a
// vizib nan JS kliyan — sa ta ekspoze kle sekrè machann nan bay tout moun.
// Nou retire `Access-Control-Allow-Origin: '*'` ki te la anvan (li te louvri
// API a pou nenpòt sit web rele l dirèkteman ak kle machann nan si l ta jwenn
// li). Entegrasyon reyèl yo (backend machann nan) pa bezwen CORS ditou.

export async function POST(request: Request) {
  const debug = isDebugSession(request);
  try {
    const ip = getClientIp(request);
    const rl = await rateLimit(`public-payments:${ip}`, 40, 60);
    if (!rl.allowed) {
      return jsonWithBuild({ error: 'Twòp demann. Eseye ankò.' }, 429);
    }

    // KOUCH SEKIRITE 2: Otantifikasyon ak verifikasyon Header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Aksè refize. Kle API (Bearer Token) manke oswa li pa fòmate byen." }, { status: 401 });
    }
    
    const apiKey = authHeader.split(' ')[1].trim();
    const idempotencyKey = (request.headers.get('idempotency-key') || request.headers.get('Idempotency-Key') || '').trim().slice(0, 200);

    // Konekte ak Supabase avèk dwa Sèvè pou tranzaksyon finansye
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // KOUCH SEKIRITE 3: Verifikasyon Estati Machann nan (kle API hash nan baz done)
    const merchant = await authenticateMerchantApiKey(supabase, apiKey);

    if (!merchant || !merchant.is_merchant) {
      return NextResponse.json({ error: "Kle API sa a pa valab oswa kont lan pa otorize pou resevwa peman." }, { status: 403 });
    }
    if (merchant.account_status !== 'active') {
      return NextResponse.json({ error: "Kont machann sa a pa aktif. Tranzaksyon an anile." }, { status: 403 });
    }

    // KOUCH SEKIRITE 3B: IDEMPOTENCY (tankou Stripe) — si machann nan voye menm
    // `Idempotency-Key` la de fwa, nou retounen MENM rezilta a san refè peman an.
    if (idempotencyKey) {
      const { data: existingIdem } = await supabase
        .from('api_idempotency_keys')
        .select('response_body')
        .eq('merchant_id', merchant.id)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingIdem?.response_body) {
        return NextResponse.json(existingIdem.response_body, { status: 200, headers: { 'Idempotent-Replayed': 'true' } });
      }
    }

    // Rale done yo ak Pwoteksyon kont kòd malveyan
    const body = await request.json();
    const { amount, currency, order_id, card_info } = body;

    // KOUCH SEKIRITE 4: Validasyon Done Strik (Regex)
    const cleanCard = String(card_info?.number || '').replace(/\D/g, ''); // Sèlman chif
    const cleanCvv = String(card_info?.cvv || '').replace(/\D/g, '');
    const rawExp = String(card_info?.exp || '').replace(/\D/g, '');
    const safeAmount = parseFloat(Number(amount).toFixed(2)); // Evite chif desimal enfini
    const cleanOrderId = String(order_id || '').trim().substring(0, 50); // Limite longè order_id

    if (cleanCard.length < 15 || cleanCvv.length < 3 || rawExp.length !== 4 || isNaN(safeAmount) || safeAmount <= 0) {
      return NextResponse.json({ error: "Fòma done yo pa bon. Tcheke kat la, CVV a, Dat la (MMYY), oswa kantite kòb la." }, { status: 400 });
    }

    const slashedExp = `${rawExp.slice(0, 2)}/${rawExp.slice(2)}`; // "MM/YY"

    // KOUCH SEKIRITE 5: Anti-Doublon (Idempotency Check) — pre-check rapid.
    // Chèk final ak garanti a fèt ATOMIKMAN anndan RPC `process_direct_card_payment`
    // pi ba a (kont yon kous ant 2 rekèt similtane pou menm kòmand lan).
    if (cleanOrderId && cleanOrderId !== 'N/A') {
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', merchant.id)
        .like('description', `%Kòmand #${cleanOrderId}%`)
        .single();
        
      if (existingTx) {
        return NextResponse.json({ error: "Peman sa a fèt deja pou kòmand sa a (Pwoteksyon Anti-Doublon)." }, { status: 409 });
      }
    }

    // KOUCH SEKIRITE 6: Verifikasyon Kliyan (Kat)
    const { profile: client, error: cardError } = await findProfileByCard(
      supabase,
      cleanCard,
      cleanCvv,
      rawExp,
      slashedExp
    );

    if (!client) {
      return NextResponse.json({ error: cardError || "Tranzaksyon refize. Enfòmasyon kat yo pa koresponn." }, { status: 401 });
    }

    // Reli balans FRESH dirèkteman nan baz done (pa sèlman sa lookup kat la retounen).
    const { data: freshClient, error: freshClientErr } = await supabase
      .from('profiles')
      .select('id, card_balance, wallet_balance, account_status, full_name, account_type')
      .eq('id', client.id)
      .single();

    if (freshClientErr || !freshClient) {
      return NextResponse.json({ error: 'Pa kapab verifye balans kliyan an.' }, { status: 500 });
    }

    if (freshClient.account_status !== 'active') {
      return NextResponse.json({ error: "Kont ki asosye ak kat sa a pa aktif." }, { status: 403 });
    }

    const clientBalances = normalizeClientBalances(freshClient);
    if (debug) {
      debugLog('public/payments:balances', 'Fresh client balances loaded', {
        build: API_BUILD_VERSION,
        card_balance: clientBalances.card_balance,
        wallet_balance: clientBalances.wallet_balance,
        safeAmount,
        merchantIdPrefix: String(merchant.id).slice(0, 8),
        clientIdPrefix: String(freshClient.id).slice(0, 8),
        sameAccount: freshClient.id === merchant.id,
      }, 'H2');
    }
    if (!clientCanPayAmount(clientBalances, safeAmount)) {
      const errBody: Record<string, unknown> = {
        error: insufficientClientFundsMessage(clientBalances, safeAmount),
        balances: balanceDiagnostics(clientBalances, safeAmount),
      };
      if (debug) {
        errBody.debug = { step: 'pre_check_balances', ...clientBalances, safeAmount };
      }
      return jsonWithBuild(errBody, 400);
    }

    if (freshClient.id === merchant.id) {
      const errBody: Record<string, unknown> = {
        error: 'Ou pa ka itilize menm kont pou machann ak kliyan. Kreye/yon lòt kont kòm kliyan pou teste API a.',
      };
      if (debug) errBody.debug = { step: 'self_payment_blocked', build: API_BUILD_VERSION };
      return jsonWithBuild(errBody, 400);
    }

    // KOUCH SEKIRITE 6B: Limit Depans Jounalye/Mansyèl kliyan an (kont Antrepriz gen limit pi wo)
    const limitCheck = await checkSpendingLimit(supabase, freshClient.id, freshClient.account_type, safeAmount, 'card');
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.message || "Limit depans depase." }, { status: 400 });
    }

    // KOUCH SEKIRITE 6C: Plafon Balans Maksimòm pou Machann k ap resevwa kòb la
    const capCheck = checkBalanceCap(Number(merchant.wallet_balance || 0), merchant.account_type, safeAmount);
    if (!capCheck.allowed) {
      return NextResponse.json({ error: capCheck.message || "Balans machann nan ta depase limit maksimòm otorize a." }, { status: 400 });
    }

    // KOUCH SEKIRITE 6D: Limit RESEPSYON API (pa-tranzaksyon + pa-jou, 50k/2M).
    // Pre-check rapid; chèk final la fèt ATOMIKMAN anndan RPC a.
    const receiveCheck = await checkApiReceiveLimit(supabase, merchant.id, merchant.account_type, safeAmount);
    if (!receiveCheck.allowed) {
      return NextResponse.json({ error: receiveCheck.message || "Limit resepsyon API depase." }, { status: 400 });
    }

    // ==================================================
    // 🔐 KOUCH SEKIRITE 7: EKZEKISYON FINANSYE ATOMIK
    // ==================================================
    // Olye fè 2 UPDATE separe (jan sa te ye anvan — risk kòb disparèt si
    // sèvè a echwe ant 2 yo, oswa kous ant 2 rekèt similtane), nou rele
    // yon SÈL fonksyon RPC ki fè chèk balans, chèk limit resepsyon, debi,
    // kredi, ak jounal tranzaksyon an TOUT ANSANM, ATOMIKMAN, ak veriwou.
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
      if (debug) {
        debugLog('public/payments:rpc_fail', 'RPC process_direct_card_payment failed', {
          build: API_BUILD_VERSION,
          rpcMessage,
          rpcError: rpcError?.message || null,
          card_balance: clientBalances.card_balance,
          wallet_balance: clientBalances.wallet_balance,
          safeAmount,
        }, 'H4');
      }
      const errBody: Record<string, unknown> = {
        error: rpcMessage,
        balances: balanceDiagnostics(clientBalances, safeAmount),
      };
      if (debug) {
        errBody.debug = {
          step: 'rpc_failed',
          rpcMessage,
          hint: rpcMessage === 'Fon ensifizan.' ? 'RPC ansyen sou Supabase — kouri migrasyon 20260721' : undefined,
        };
      } else if (rpcMessage === 'Fon ensifizan.') {
        errBody.hint = 'Kouri migrasyon 20260721 sou Supabase epi redeploy Vercel (GET /api/public/payments dwe bay build 20260721-balance-v2).';
      }
      return jsonWithBuild(errBody, status);
    }

    const transactionId: string = rpcResult.transaction_id;

    const successResponse = {
      success: true,
      message: "Peman an fèt ak siksè!",
      transaction_id: transactionId,
      customer: freshClient.full_name,
      amount_charged: safeAmount,
      debited_from: rpcResult.debited_from || 'unknown',
    };

    // Anrejistre repons lan pou idempotency (si yon kle te bay).
    if (idempotencyKey) {
      await supabase.from('api_idempotency_keys').insert({
        merchant_id: merchant.id,
        idempotency_key: idempotencyKey,
        response_body: successResponse,
      });
    }

    // ==================================================
    // KOUCH SEKIRITE 8: WEBHOOK MILTI-PWEN SIYEN (deliverWebhookEvent)
    // ==================================================
    // Voye evènman an bay TOUT pwen webhook aktif machann nan ki abòne a
    // `payment.success`, ak siyati HMAC + timestamp (kont replay), epi
    // anrejistre chak delivrans (pou re-eseye otomatik si l echwe).
    await deliverWebhookEvent(supabase, merchant.id, 'payment.success', {
      transaction_id: transactionId,
      order_id: cleanOrderId || 'N/A',
      amount: safeAmount,
      currency: currency || 'HTG',
      customer_name: freshClient.full_name,
    });

    // REYISI FINAL LA
    return jsonWithBuild(successResponse);

  } catch (error: any) {
    console.error("[CRITICAL ERROR] HatexCard Payment Gateway:", error);
    return NextResponse.json({ error: "Sèvè a rankontre yon erè kritik. Tanpri kontakte sipò HatexCard." }, { status: 500 });
  }
}
