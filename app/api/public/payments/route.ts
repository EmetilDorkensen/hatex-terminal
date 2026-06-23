import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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
    // 1. OTANTIFIKASYON API KEY (BEARER TOKEN)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Otorizasyon manke. Mete 'Bearer hx_live_...'" }, { status: 401, headers: corsHeaders });
    }
    
    const apiKey = authHeader.split(' ')[1];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 2. IDANTIFYE MACHANN NAN AK VERIFYE ESTATI L
    const { data: merchant, error: merchantErr } = await supabase
      .from('profiles')
      .select('id, full_name, is_merchant, account_status, wallet_balance, webhook_url, webhook_secret')
      .eq('api_key', apiKey)
      .single();

    if (merchantErr || !merchant || !merchant.is_merchant) {
      return NextResponse.json({ error: "Kòd API a pa rekonèt." }, { status: 403, headers: corsHeaders });
    }
    if (merchant.account_status === 'suspended') {
      return NextResponse.json({ error: "Kont machann sa a sispandi kounye a." }, { status: 403, headers: corsHeaders });
    }

    // 3. SANITIZATION DONE KLIYAN AN (Pwoteksyon kont piki kòd)
    const body = await request.json();
    const { amount, currency, order_id, card_info } = body;

    const cleanCard = String(card_info?.number).replace(/\s/g, '');
    const safeAmount = Number(amount);

    if (!cleanCard || !card_info?.cvv || isNaN(safeAmount) || safeAmount < 10) {
      return NextResponse.json({ error: "Enfòmasyon kòmand oswa kat la pa valab." }, { status: 400, headers: corsHeaders });
    }

    // 4. VERIFIKASYON BLENDE POU KAT KLIYAN AN
    const { data: client, error: clientErr } = await supabase
      .from('profiles')
      .select('id, wallet_balance, full_name, account_status')
      .eq('card_number', cleanCard)
      .eq('cvv', String(card_info.cvv))
      .single();

    if (clientErr || !client) return NextResponse.json({ error: "Kat la pa valab oswa CVV a pa bon." }, { status: 401, headers: corsHeaders });
    if (client.account_status === 'suspended') return NextResponse.json({ error: "Kont ou a sispandi. Tranzaksyon an anile." }, { status: 403, headers: corsHeaders });
    if (Number(client.wallet_balance) < safeAmount) return NextResponse.json({ error: "Balans ensifizan sou kat la pou peman sa a." }, { status: 400, headers: corsHeaders });

    // =========================================================
    // 5. EGZEKISYON PEMAN AN (Rale nan kliyan, mete sou machann)
    // =========================================================
    
    // A. Koupe kòb la sou kliyan an
    const nouvoBalansKliyan = Number(client.wallet_balance) - safeAmount;
    await supabase.from('profiles').update({ wallet_balance: nouvoBalansKliyan }).eq('id', client.id);

    // B. Ajoute kòb la sou kont machann nan dirèkteman
    const nouvoBalansMachann = Number(merchant.wallet_balance) + safeAmount;
    await supabase.from('profiles').update({ wallet_balance: nouvoBalansMachann }).eq('id', merchant.id);

    const transactionId = `HTX-${Date.now().toString().slice(-8)}`;

    // C. Anrejistre resi tranzaksyon yo
    await supabase.from('transactions').insert([
      { user_id: client.id, amount: -safeAmount, type: 'PURCHASE', description: `Peman bay ${merchant.full_name} (Kòmand #${order_id})`, status: 'success' },
      { user_id: merchant.id, amount: safeAmount, type: 'SALE', description: `Lavant API: Kliyan ${client.full_name} (Kòmand #${order_id})`, status: 'success' }
    ]);

    // =========================================================
    // 6. SISTÈM WEBHOOK KRIPTE POU MACHANN NAN
    // =========================================================
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
      // Siyati kriptografik pou sekirize done yo an transi
      const signature = crypto.createHmac('sha256', merchant.webhook_secret).update(payloadString).digest('hex');

      fetch(merchant.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hatex-signature': signature },
        body: payloadString
      }).catch(err => console.error("Echèk Webhook:", err));
    }

    // 7. REPONS POU APLIKASYON K'AP MANDE PEMAN AN
    return NextResponse.json({ 
      success: true, 
      message: "Peman an fèt ak siksè!",
      transaction_id: transactionId,
      customer: client.full_name,
      amount_charged: safeAmount
    }, { headers: corsHeaders });

  } catch (error: any) {
    return NextResponse.json({ error: "Erè entèn nan sistèm peman an." }, { status: 500, headers: corsHeaders });
  }
}