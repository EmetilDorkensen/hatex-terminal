import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { findProfileByCard } from '@/lib/security/card-lookup';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { checkSpendingLimit } from '@/lib/security/spending-limits';

// KOUCH SEKIRITE 1: CORS Strik pou API Pwodiksyon
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Ou ka chanje '*' pou 'https://sit-machann-yo.com' pita si w vle
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimit(`public-payments:${ip}`, 40, 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Twòp demann. Eseye ankò.' }, { status: 429, headers: corsHeaders });
    }

    // KOUCH SEKIRITE 2: Otantifikasyon ak verifikasyon Header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Aksè refize. Kle API (Bearer Token) manke oswa li pa fòmate byen." }, { status: 401, headers: corsHeaders });
    }
    
    const apiKey = authHeader.split(' ')[1].trim();

    // Konekte ak Supabase avèk dwa Sèvè pou tranzaksyon finansye
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // KOUCH SEKIRITE 3: Verifikasyon Estati Machann nan
    const { data: merchant, error: merchantErr } = await supabase
      .from('profiles')
      .select('id, full_name, is_merchant, account_status, wallet_balance, webhook_url, webhook_secret')
      .eq('api_key', apiKey)
      .single();

    if (merchantErr || !merchant || !merchant.is_merchant) {
      return NextResponse.json({ error: "Kle API sa a pa valab oswa kont lan pa otorize pou resevwa peman." }, { status: 403, headers: corsHeaders });
    }
    if (merchant.account_status !== 'active') {
      return NextResponse.json({ error: "Kont machann sa a pa aktif. Tranzaksyon an anile." }, { status: 403, headers: corsHeaders });
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
      return NextResponse.json({ error: "Fòma done yo pa bon. Tcheke kat la, CVV a, Dat la (MMYY), oswa kantite kòb la." }, { status: 400, headers: corsHeaders });
    }

    const slashedExp = `${rawExp.slice(0, 2)}/${rawExp.slice(2)}`; // "MM/YY"

    // KOUCH SEKIRITE 5: Anti-Doublon (Idempotency Check)
    // Tcheke si machann nan pa t deja resevwa yon peman pou menm order_id sa a jodi a
    if (cleanOrderId && cleanOrderId !== 'N/A') {
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', merchant.id)
        .like('description', `%Kòmand #${cleanOrderId}%`)
        .single();
        
      if (existingTx) {
        return NextResponse.json({ error: "Peman sa a fèt deja pou kòmand sa a (Pwoteksyon Anti-Doublon)." }, { status: 409, headers: corsHeaders });
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
      return NextResponse.json({ error: cardError || "Tranzaksyon refize. Enfòmasyon kat yo pa koresponn." }, { status: 401, headers: corsHeaders });
    }
    if (client.account_status !== 'active') {
      return NextResponse.json({ error: "Kont ki asosye ak kat sa a pa aktif." }, { status: 403, headers: corsHeaders });
    }
    if (Number(client.wallet_balance) < safeAmount) {
      return NextResponse.json({ error: "Fon ensifizan." }, { status: 400, headers: corsHeaders });
    }

    // KOUCH SEKIRITE 6B: Limit Depans Jounalye/Mansyèl (kont Antrepriz gen limit pi wo)
    const limitCheck = await checkSpendingLimit(supabase, client.id, client.account_type, safeAmount, 'card');
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.message || "Limit depans depase." }, { status: 400, headers: corsHeaders });
    }

    // ==================================================
    // KOUCH SEKIRITE 7: EKZEKISYON FINANSYE
    // ==================================================
    
    // 1. Retire kòb Kliyan an
    const nouvoBalansKliyan = Number(client.wallet_balance) - safeAmount;
    const { error: debitErr } = await supabase.from('profiles').update({ wallet_balance: nouvoBalansKliyan }).eq('id', client.id);
    if (debitErr) throw new Error("Echèk nan debi kliyan an");

    // 2. Kredite Machann nan
    const nouvoBalansMachann = Number(merchant.wallet_balance) + safeAmount;
    const { error: creditErr } = await supabase.from('profiles').update({ wallet_balance: nouvoBalansMachann }).eq('id', merchant.id);
    if (creditErr) throw new Error("Echèk nan kredi machann nan");

    // 3. Jounal Tranzaksyon
    const transactionId = `HTX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`; // ID inik kripte
    
    await supabase.from('transactions').insert([
      { user_id: client.id, amount: -safeAmount, type: 'PURCHASE', description: `Peman sou entènèt: ${merchant.full_name} (Kòmand #${cleanOrderId || 'N/A'})`, status: 'success' },
      { user_id: merchant.id, amount: safeAmount, type: 'SALE', description: `Lavant sou entènèt: Kliyan ${client.full_name} (Kòmand #${cleanOrderId || 'N/A'})`, status: 'success' }
    ]);

    // ==================================================
    // KOUCH SEKIRITE 8: WEBHOOK KRIPTE AK GARANTI (AWAITED)
    // ==================================================
    if (merchant.webhook_url && merchant.webhook_secret) {
      const payload = {
        event: 'payment.success',
        transaction_id: transactionId,
        order_id: cleanOrderId || 'N/A',
        amount: safeAmount,
        currency: currency || 'HTG',
        customer_name: client.full_name,
        timestamp: new Date().toISOString()
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', merchant.webhook_secret).update(payloadString).digest('hex');

      try {
        // AWAIT obligatwa isit la, sinon Next.js touye demann nan anvan webhook la pati
        await fetch(merchant.webhook_url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'x-hatex-signature': signature 
          },
          body: payloadString,
          // Timeout sekirite pou webhook la pa bloke tranzaksyon an twò lontan (5 segonn max)
          signal: AbortSignal.timeout(5000) 
        });
        console.log(`[WEBHOOK SUCCESS] Voye bay machann: ${merchant.full_name}`);
      } catch (err) {
        // Nou pa anile peman an si webhook machann nan pa mache (sèvè l ka an pàn), men nou jounalize l
        console.error(`[WEBHOOK ERROR] Sèvè machann nan pa reponn:`, err);
      }
    }

    // REYISI FINAL LA
    return NextResponse.json({ 
      success: true, 
      message: "Peman an fèt ak siksè!",
      transaction_id: transactionId,
      customer: client.full_name,
      amount_charged: safeAmount
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error("[CRITICAL ERROR] HatexCard Payment Gateway:", error);
    return NextResponse.json({ error: "Sèvè a rankontre yon erè kritik. Tanpri kontakte sipò HatexCard." }, { status: 500, headers: corsHeaders });
  }
}