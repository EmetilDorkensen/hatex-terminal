// app/api/direct-payment/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    const body = await req.json();
    const { 
      merchant_api_key, amount_htg, order_id, 
      card_number, card_expiry, card_cvv, customer_info 
    } = body;

    if (!merchant_api_key || !card_number || !card_cvv) {
      return NextResponse.json({ error: 'Manke enfòmasyon kat la oswa kle machann nan.' }, { status: 400 });
    }

    // ========================================================================
    // 🚨 1. NOU CHÈCHE KOLÒN "email" LA NAN TAB PROFILES LA GRAS AK API KEY A
    // ========================================================================
    const { data: merchant, error: merchantErr } = await supabaseAdmin
      .from('profiles')
      .select('id, account_status, email') // Nou rale sèlman "email" pwofil la
      .eq('api_key', merchant_api_key)
      .single();

    if (merchantErr || !merchant) return NextResponse.json({ error: 'Machann pa rekonèt.' }, { status: 404 });
    if (merchant.account_status === 'suspended') return NextResponse.json({ error: 'Kont machann sa bloke.' }, { status: 403 });

    // 2. Kreye fakti a
    const { data: paymentRequest, error: insertErr } = await supabaseAdmin
      .from('payment_requests')
      .insert([{
        merchant_id: merchant.id,
        amount: Number(amount_htg),
        order_id: order_id,
        redirect_url: 'direct',
        webhook_url: 'direct'
      }])
      .select()
      .single();

    if (insertErr) throw insertErr;

    // 3. Koupe kòb la sou Kat kliyan an pou mete l nan Wallet machann nan
    const cleanCardNumber = card_number.replace(/\s/g, '');
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('process_merchant_payment_with_card', {
      p_payment_id: paymentRequest.id,
      p_card_number: cleanCardNumber,
      p_exp_date: card_expiry,
      p_cvv: card_cvv
    });

    if (rpcError || !result.success) {
       return NextResponse.json({ error: result?.message || "Echèk nan verifye kat la." }, { status: 400 });
    }

    // 4. Anrejistre kòmand lan nan tablodbò a
    await supabaseAdmin.from('plugin_transactions').insert([{
       merchant_id: merchant.id,
       amount_htg: Number(amount_htg),
       original_amount: Number(amount_htg),
       currency: 'HTG',
       order_id: order_id,
       customer_info: customer_info,
       status: 'completed'
    }]);

    // ========================================================================
    // 🚨 5. NOU VOYE "email" MACHANN NAN BAY PLUGIN PHP A POU L TIRE MESAJ LA
    // ========================================================================
    return NextResponse.json({ 
        success: true, 
        message: 'Peman an pase!',
        merchant_email: merchant.email // Se la a Plugin nan ap pran l pou l voye foto yo!
    });

  } catch (error: any) {
    console.error("Direct API Error:", error);
    return NextResponse.json({ error: 'Erè nan sèvè HatexCard la.' }, { status: 500 });
  }
}