import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get('x-api-key');
    
    // 1. OTANTIFIKASYON MACHANN NAN (Nan yon vrè sistèm, w ap tcheke API KEY sa nan baz done a pou w konn kiyès machann nan ye)
    if (!apiKey || !apiKey.startsWith('htx_live_')) {
      return NextResponse.json({ error: "❌ Otorizasyon Refize. Ou pa bay yon API Key ki valab." }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { amount, card_number, cvv, order_id, merchant_webhook_url } = body;

    // SANITIZATION
    const cleanCard = String(card_number).replace(/\s/g, '');
    const safeAmount = Number(amount);

    if (!cleanCard || !cvv || isNaN(safeAmount) || safeAmount <= 0) {
      return NextResponse.json({ error: "Enfòmasyon yo pa konplè oswa yo pa valab." }, { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 2. TCHEKE KAT LA AK ESTATI KONT LAN
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, wallet_balance, full_name, account_status')
      .eq('card_number', cleanCard)
      .eq('cvv', String(cvv))
      .single();

    if (profileErr || !profile) return NextResponse.json({ error: "Kat la pa rekonèt." }, { status: 401, headers: corsHeaders });
    if (profile.account_status === 'suspended') return NextResponse.json({ error: "🚫 Kont sa sispandi." }, { status: 403, headers: corsHeaders });
    if (Number(profile.wallet_balance) < safeAmount) return NextResponse.json({ error: "Balans ensifizan." }, { status: 400, headers: corsHeaders });

    // 3. KOUPE KÒB LA
    const nouvoBalans = Number(profile.wallet_balance) - safeAmount;
    await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', profile.id);

    const transactionId = `HTX-${Date.now().toString().slice(-8)}`;

    await supabase.from('transactions').insert({
      user_id: profile.id,
      amount: -safeAmount,
      type: 'API_GATEWAY_PAYMENT',
      description: `Peman API pou kòmand #${order_id}`,
      status: 'success'
    });

    // =========================================================================
    // 4. SISTÈM WEBHOOK SEKIRIZE A (Kominikasyon ak sèvè machann nan)
    // =========================================================================
    
    // Nan yon vrè pwojè, webhook_secret la ta dwe anrejistre nan baz done w la anba pwofil machann nan.
    // Nou itilize li pou nou siyen mesaj la pou haker pa ka voye fo webhook bay machann nan.
    const WEBHOOK_SECRET = process.env.HATEX_WEBHOOK_SECRET || "sekrè_webhook_hatexcard_pou_machann_sa_a"; 

    if (merchant_webhook_url) {
      // Konstwi pakè done ki pral jwenn machann nan
      const payload = {
        event: 'payment.success',
        transaction_id: transactionId,
        order_id: order_id,
        amount: safeAmount,
        currency: 'HTG',
        customer_name: profile.full_name,
        timestamp: new Date().toISOString()
      };

      const payloadString = JSON.stringify(payload);

      // Kreye Siyati Kriptografik la (HMAC SHA-256)
      const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payloadString).digest('hex');

      // Tire Webhook la nan fènwa (pa bloke repons API a pou sa)
      fetch(merchant_webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hatex-signature': signature // Nou glise siyati a nan header a
        },
        body: payloadString
      }).catch(err => console.error("Webook la echwe:", err));
      // Nòt: Nan gwo sistèm, ou ta itilize yon zouti tankou "BullMQ" oswa "Inngest" pou re-seye voye webhook la si sèvè machann nan anpàn.
    }

    // 5. REPONS POU ENTÈFAS (Frontend) LA
    return NextResponse.json({ 
      success: true, 
      transaction_id: transactionId
    }, { headers: corsHeaders });

  } catch (error: any) {
    return NextResponse.json({ error: "Sèvè a jwenn yon pwoblèm." }, { status: 500, headers: corsHeaders });
  }
}