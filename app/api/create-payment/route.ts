import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    // 🚨 KONEKSYON AN DWE ANNDAN FONKSYON AN POU NEXT.JS PA BAY ERÈ 🚨
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    // 1. Nou resevwa done WordPress/WooCommerce la voye yo
    const body = await req.json();
    const { merchant_api_key, amount_htg, order_id, redirect_url, webhook_url, customer_info } = body;

    // Tcheke si l voye tout enfòmasyon yo
    if (!merchant_api_key || !amount_htg || !order_id || !redirect_url) {
      return NextResponse.json({ error: 'Manke enfòmasyon nan demann lan' }, { status: 400 });
    }

    // 2. Nou verifye si machann sa a gen kont HatexCard vre gras ak API Key a
    const { data: merchant, error: merchantErr } = await supabaseAdmin
      .from('profiles')
      .select('id, account_status')
      .eq('api_key', merchant_api_key) // Verifye ak kòd "hx_live_..." la
      .single();

    if (merchantErr || !merchant) {
      return NextResponse.json({ error: 'Machann sa a pa rekonèt sou HatexCard' }, { status: 404 });
    }

    if (merchant.account_status === 'suspended') {
      return NextResponse.json({ error: 'Kont machann sa a bloke. Peman enposib.' }, { status: 403 });
    }

    // 3. Nou kreye "Tikè Peman an" (Fakti a) nan baz done nou an
    const { data: paymentRequest, error: insertErr } = await supabaseAdmin
      .from('payment_requests')
      .insert([{
        merchant_id: merchant.id,
        amount: Number(amount_htg),
        order_id: order_id,
        redirect_url: redirect_url,
        webhook_url: webhook_url || null
      }])
      .select()
      .single();

    if (insertErr) throw insertErr;

    // 4. Nou jere Lyen Peman an epi nou voye l bay sit WordPress la
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const checkoutUrl = `${baseUrl}/pay/${paymentRequest.id}`;

    return NextResponse.json({ 
      success: true, 
      payment_id: paymentRequest.id,
      checkout_url: checkoutUrl 
    });

  } catch (error: any) {
    console.error("API Payment Error:", error);
    return NextResponse.json({ error: 'Erè nan sèvè HatexCard la' }, { status: 500 });
  }
}