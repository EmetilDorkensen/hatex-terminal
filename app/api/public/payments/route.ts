import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Pèmèt nenpòt aplikasyon oswa fichye lokal (tankou teste-api.html) konekte san pwoblèm CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    // 1. OTANTIFIKASYON API KEY (Nou tcheke tou de fòma yo pou evite erè 401)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: "Aksè refize. Kle API (Bearer Token) manke oswa li pa fòmate byen." }, 
        { status: 401, headers: corsHeaders }
      );
    }
    
    const apiKey = authHeader.split(' ')[1]; // Rale kòd hx_live_ la sèlman

    // Konekte ak Supabase avèk dwa Sèvè (Bypass RLS pou tranzaksyon finansye)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 2. IDANTIFYE AK VERIFYE MACHANN NAN
    const { data: merchant, error: merchantErr } = await supabase
      .from('profiles')
      .select('id, full_name, is_merchant, account_status, wallet_balance, webhook_url, webhook_secret')
      .eq('api_key', apiKey)
      .single();

    if (merchantErr || !merchant || !merchant.is_merchant) {
      return NextResponse.json({ error: "Kle API (Secret Key) sa a pa bon oswa kont lan pa machann." }, { status: 403, headers: corsHeaders });
    }
    if (merchant.account_status === 'suspended') {
      return NextResponse.json({ error: "Kont machann sa a sispandi. Tranzaksyon an anile." }, { status: 403, headers: corsHeaders });
    }

    // 3. RALE EPI NETWAYE DONE KLIYAN AN VOYE YO
    const body = await request.json();
    const { amount, currency, order_id, card_info } = body;

    // Retire espas nan nimewo kat la si devlopè a te voye l ak espas (egz: "4550 1234...")
    const cleanCard = String(card_info?.number || '').replace(/\s/g, '');
    const expDateInput = String(card_info?.exp || '');
    const cvvInput = String(card_info?.cvv || '');
    const safeAmount = Number(amount);

    // Validasyon debaz pou asire tout enfòmasyon kat la la
    if (!cleanCard || !expDateInput || !cvvInput || isNaN(safeAmount) || safeAmount < 10) {
      return NextResponse.json({ error: "Done yo manke. Ou dwe bay: amount, number, exp, ak cvv." }, { status: 400, headers: corsHeaders });
    }

    // 4. VRÈ VERIFIKASYON ENFO KAT YO (NIMEWO / CVV / EXP_DATE)
    const { data: client, error: clientErr } = await supabase
      .from('profiles')
      .select('id, wallet_balance, full_name, account_status')
      .eq('card_number', cleanCard)
      .eq('cvv', cvvInput)
      .eq('exp_date', expDateInput) // Verifye dat ekspirasyon egzak la
      .single();

    // Si Supabase pa jwenn anyen, sa vle di youn nan 3 enfo yo pa bon
    if (clientErr || !client) {
      return NextResponse.json({ error: "Kat la pa valab oswa enfòmasyon yo (Nimewo, CVV, Dat EXP) pa koresponn." }, { status: 401, headers: corsHeaders });
    }
    if (client.account_status === 'suspended') {
      return NextResponse.json({ error: "Kont kliyan sa a sispandi." }, { status: 403, headers: corsHeaders });
    }
    if (Number(client.wallet_balance) < safeAmount) {
      return NextResponse.json({ error: "Balans kat la ensifizan pou fè peman sa a." }, { status: 400, headers: corsHeaders });
    }

    // 5. EKZEKISYON PEMAN AN (Debite Kliyan, Kredite Machann)
    
    // A. Retire kòb sou kont Kliyan an
    const nouvoBalansKliyan = Number(client.wallet_balance) - safeAmount;
    await supabase.from('profiles').update({ wallet_balance: nouvoBalansKliyan }).eq('id', client.id);

    // B. Mete kòb la sou kont Machann nan
    const nouvoBalansMachann = Number(merchant.wallet_balance) + safeAmount;
    await supabase.from('profiles').update({ wallet_balance: nouvoBalansMachann }).eq('id', merchant.id);

    // Kòd Tranzaksyon inik
    const transactionId = `HTX-${Date.now().toString().slice(-8)}`;

    // C. Ekri istoral Tranzaksyon yo nan Journal la
    await supabase.from('transactions').insert([
      { user_id: client.id, amount: -safeAmount, type: 'PURCHASE', description: `Peman API bay ${merchant.full_name} (Kòmand #${order_id || 'N/A'})`, status: 'success' },
      { user_id: merchant.id, amount: safeAmount, type: 'SALE', description: `Lavant API: Kliyan ${client.full_name} (Kòmand #${order_id || 'N/A'})`, status: 'success' }
    ]);

    // 6. SISTÈM WEBHOOK OTOMATIK SOU SIT MACHANN NAN (Nan fènwa)
    if (merchant.webhook_url && merchant.webhook_secret) {
      const payload = {
        event: 'payment.success',
        transaction_id: transactionId,
        order_id: order_id || 'N/A',
        amount: safeAmount,
        currency: currency || 'HTG',
        customer_name: client.full_name,
        timestamp: new Date().toISOString()
      };

      const payloadString = JSON.stringify(payload);
      // Siyen mesaj la ak HMAC SHA-256 pou sekirite rezo a
      const signature = crypto.createHmac('sha256', merchant.webhook_secret).update(payloadString).digest('hex');

      fetch(merchant.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hatex-signature': signature },
        body: payloadString
      }).catch(err => console.error("Echèk voye Webhook:", err));
    }

    // 7. REYISI: REPONS JSON FINAL LA
    return NextResponse.json({ 
      success: true, 
      message: "Peman an fèt ak siksè!",
      transaction_id: transactionId,
      customer: client.full_name,
      amount_charged: safeAmount
    }, { headers: corsHeaders });

  } catch (error: any) {
    return NextResponse.json({ error: "Sèvè a jwenn yon erè teknik pandan l t ap trete peman an." }, { status: 500, headers: corsHeaders });
  }
}