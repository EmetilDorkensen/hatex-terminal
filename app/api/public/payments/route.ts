import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Manke Kle API.' }, { status: 401 });
    }
    const merchant_api_key = authHeader.split(' ')[1];

    const body = await req.json();
    const { amount, currency, order_id, card_info } = body;

    if (!amount || !order_id || !card_info || !card_info.number || !card_info.exp || !card_info.cvv) {
      return NextResponse.json({ error: 'Enfòmasyon yo pa konplè.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    const { data: merchant, error: merchantErr } = await supabaseAdmin
      .from('profiles')
      .select('id, account_status')
      .eq('api_key', merchant_api_key)
      .single();

    if (merchantErr || !merchant) return NextResponse.json({ error: 'Kle API sa pa bon.' }, { status: 401 });
    if (merchant.account_status === 'suspended') return NextResponse.json({ error: 'Kont machann sa bloke.' }, { status: 403 });

    const { data: paymentRequest, error: insertErr } = await supabaseAdmin
      .from('payment_requests')
      .insert([{
        merchant_id: merchant.id,
        amount: Number(amount),
        order_id: order_id,
        redirect_url: 'api_public',
        webhook_url: 'api_public'
      }])
      .select()
      .single();

    if (insertErr) throw insertErr;

    const cleanCardNumber = card_info.number.replace(/\s/g, '');
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('process_merchant_payment_with_card', {
      p_payment_id: paymentRequest.id,
      p_card_number: cleanCardNumber,
      p_exp_date: card_info.exp,
      p_cvv: card_info.cvv
    });

    if (rpcError || !result.success) {
       return NextResponse.json({ error: result?.message || "Echèk nan verifye kat la." }, { status: 400 });
    }

    // 🚨 NOUVO MAJI A: Nou jenere yon kòd 4 chif pou livrezon an!
    const delivery_otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Nou sere OTP a nan baz done a ansanm ak tranzaksyon an
    await supabaseAdmin.from('plugin_transactions').insert([{
       merchant_id: merchant.id,
       amount_htg: Number(amount),
       original_amount: Number(amount),
       currency: currency || 'HTG',
       order_id: order_id,
       customer_info: { 
         source: 'api_public', 
         description: 'Peman via Public API',
         delivery_otp: delivery_otp // 🚨 Nou sove kòd la la a
       },
       status: 'completed' // Pita nou ka chanje l an 'pending_delivery' si n vle!
    }]);

    // Nou voye OTP a nan repons lan pou devlopè a / plugin nan ka wè l
    return NextResponse.json({ 
        success: true, 
        message: 'Peman an pase nèt!',
        transaction_id: paymentRequest.id,
        amount_charged: Number(amount),
        currency: currency || 'HTG',
        status: 'completed',
        delivery_otp: delivery_otp // 🚨 Nou pase l bay aplikasyon an
    });

  } catch (error: any) {
    console.error("Public API Error:", error);
    return NextResponse.json({ error: 'Erè nan sèvè pwensipal HatexCard la.' }, { status: 500 });
  }
}