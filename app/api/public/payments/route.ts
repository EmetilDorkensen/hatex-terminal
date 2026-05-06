import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    // 1. NOU PRAN KLE API A NAN HEADERS YO (Estanda Devlopè)
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Manke Kle API. Itilize: Bearer <kle_ou_a>' }, { status: 401 });
    }
    const merchant_api_key = authHeader.split(' ')[1];

    // 2. NOU PRAN ENFÒMASYON DEVLOPÈ A VOYE YO
    const body = await req.json();
    const { amount, currency, order_id, card_info } = body;

    // Verifikasyon si tout done yo la
    if (!amount || !order_id || !card_info || !card_info.number || !card_info.exp || !card_info.cvv) {
      return NextResponse.json({ error: 'Enfòmasyon yo pa konplè. Verifye kantite kòb, order_id, ak card_info yo.' }, { status: 400 });
    }

    // Inisyalize Supabase Admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    // 3. VALIDE MACHANN NAN
    const { data: merchant, error: merchantErr } = await supabaseAdmin
      .from('profiles')
      .select('id, account_status')
      .eq('api_key', merchant_api_key)
      .single();

    if (merchantErr || !merchant) return NextResponse.json({ error: 'Kle API sa pa bon oswa machann nan pa rekonèt.' }, { status: 401 });
    if (merchant.account_status === 'suspended') return NextResponse.json({ error: 'Kont machann sa bloke.' }, { status: 403 });

    // 4. KREYE FAKTI A NAN BAZ DONE A
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

    // 5. KOUPE KÒB LA SOU KAT LA AK RPC NOU AN
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

    // 6. ANREJISTRE TRANZAKSYON AN POU DASHBOARD LA
    await supabaseAdmin.from('plugin_transactions').insert([{
       merchant_id: merchant.id,
       amount_htg: Number(amount),
       original_amount: Number(amount),
       currency: currency || 'HTG',
       order_id: order_id,
       customer_info: { source: 'api_public', description: 'Peman via Public API' },
       status: 'completed'
    }]);

    // 7. REPONN DEVLOPÈ A AK YON BON JSON
    return NextResponse.json({ 
        success: true, 
        message: 'Peman an pase nèt!',
        transaction_id: paymentRequest.id,
        amount_charged: Number(amount),
        currency: currency || 'HTG',
        status: 'completed'
    });

  } catch (error: any) {
    console.error("Public API Error:", error);
    return NextResponse.json({ error: 'Erè nan sèvè pwensipal HatexCard la.' }, { status: 500 });
  }
}