// app/api/direct-payment/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    // 1. Resevwa tout done WordPress voye yo (Enfo kat, pwodwi, elatriye)
    const body = await req.json();
    const { 
      merchant_api_key, amount_htg, order_id, 
      card_number, card_expiry, card_cvv, customer_info 
    } = body;

    if (!merchant_api_key || !card_number || !card_cvv) {
      return NextResponse.json({ error: 'Manke enfòmasyon kat la oswa kle machann nan.' }, { status: 400 });
    }

    // 2. Verifye si machann nan bon
    const { data: merchant, error: merchantErr } = await supabaseAdmin
      .from('profiles')
      .select('id, account_status')
      .eq('api_key', merchant_api_key)
      .single();

    if (merchantErr || !merchant) return NextResponse.json({ error: 'Machann pa rekonèt.' }, { status: 404 });
    if (merchant.account_status === 'suspended') return NextResponse.json({ error: 'Kont machann sa bloke.' }, { status: 403 });

    // 3. Kreye yon fo "Tikè Peman" vit vit pou fonksyon SQL la ka gen yon referans
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

    // 4. VERIFYE KAT LA EPI KOUPE KÒB LA (Avèk fonksyon SQL nou te fè a)
    const cleanCardNumber = card_number.replace(/\s/g, '');
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('process_merchant_payment_with_card', {
      p_payment_id: paymentRequest.id,
      p_card_number: cleanCardNumber,
      p_card_expiry: card_expiry,
      p_card_cvv: card_cvv
    });

    if (rpcError || !result.success) {
       return NextResponse.json({ error: result?.message || "Echèk nan verifye kat la." }, { status: 400 });
    }

    // 5. ANREJISTRE TRANZAKSYON PLUGIN NAN AK TOUT ENFO LIVREZON AK PWODWI
    await supabaseAdmin.from('plugin_transactions').insert([{
       merchant_id: merchant.id,
       amount_htg: Number(amount_htg),
       original_amount: Number(amount_htg),
       currency: 'HTG',
       order_id: order_id,
       customer_info: customer_info, // Sa gen ladan l Non, Adrès, ak Pwodwi li achte yo
       status: 'completed'
    }]);

    // 6. Reponn WordPress la li mèt bay pwodwi a!
    return NextResponse.json({ success: true, message: 'Peman an pase!' });

  } catch (error: any) {
    console.error("Direct API Error:", error);
    return NextResponse.json({ error: 'Erè nan sèvè HatexCard la.' }, { status: 500 });
  }
}