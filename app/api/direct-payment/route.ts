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
      return NextResponse.json({ error: 'Manke enfòmasyon kat la.' }, { status: 400 });
    }

    // 1. Jwenn imèl machann nan
    const { data: merchant, error: merchantErr } = await supabaseAdmin
      .from('profiles')
      .select('id, account_status, email')
      .eq('api_key', merchant_api_key)
      .single();

    if (merchantErr || !merchant) return NextResponse.json({ error: 'Machann pa rekonèt.' }, { status: 404 });
    if (merchant.account_status === 'suspended') return NextResponse.json({ error: 'Kont machann sa bloke.' }, { status: 403 });

    // 2. Kreye Fakti a
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

    // 3. Koupe kòb la sou kat la
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

    // 4. Anrejistre tranzaksyon an
    await supabaseAdmin.from('plugin_transactions').insert([{
       merchant_id: merchant.id,
       amount_htg: Number(amount_htg),
       original_amount: Number(amount_htg),
       currency: 'HTG',
       order_id: order_id,
       customer_info: customer_info,
       status: 'completed'
    }]);

    // 5. Bati imèl la
    const orderDate = new Date().toLocaleDateString('ht-HT', { year: 'numeric', month: 'long', day: 'numeric' });
    
    let productsHtml = '';
    if (customer_info.products && customer_info.products.length > 0) {
      customer_info.products.forEach((prod: any) => {
        productsHtml += `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eaeaea; color: #333;">${prod.name} × ${prod.qty}</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eaeaea; text-align: right; color: #333;">${prod.total}</td>
          </tr>
        `;
      });
    }

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h1 style="font-size: 24px; font-weight: normal; margin-bottom: 20px;">Nouvo Kòmand resi via HatexCard</h1>
        <p style="color: #666; margin-bottom: 30px;">Felisitasyon! Ou fèk resevwa yon kòmand ki peye nèt.</p>

        <table style="width: 100%; margin-bottom: 30px; font-size: 14px;">
          <tr>
            <td style="padding-bottom: 10px;"><strong>Order #:</strong><br>${order_id}</td>
            <td style="padding-bottom: 10px;"><strong>Date:</strong><br>${orderDate}</td>
            <td style="padding-bottom: 10px;"><strong>Total:</strong><br>${amount_htg} HTG</td>
          </tr>
          <tr>
            <td colspan="2"><strong>Email:</strong><br>${customer_info.email}</td>
            <td><strong>Payment:</strong><br>Peye ak HatexCard</td>
          </tr>
        </table>

        <h2 style="font-size: 18px; font-weight: normal; border-bottom: 2px solid #eaeaea; padding-bottom: 10px; margin-bottom: 15px;">Order details</h2>
        <table style="width: 100%; font-size: 14px; margin-bottom: 30px; border-collapse: collapse;">
          <tr>
            <th style="text-align: left; padding-bottom: 10px; border-bottom: 2px solid #eaeaea;">Product</th>
            <th style="text-align: right; padding-bottom: 10px; border-bottom: 2px solid #eaeaea;">Total</th>
          </tr>
          ${productsHtml}
          <tr>
            <td style="padding: 15px 0; font-weight: bold;">Total:</td>
            <td style="padding: 15px 0; text-align: right; font-weight: bold;">${amount_htg} HTG</td>
          </tr>
        </table>

        <h2 style="font-size: 18px; font-weight: normal; margin-bottom: 15px;">Billing address</h2>
        <div style="border: 1px solid #eaeaea; padding: 15px; font-size: 14px; color: #555; line-height: 1.5;">
          ${customer_info.name}<br>
          ${customer_info.address.replace(/, /g, '<br>')}<br>
          ${customer_info.phone}
        </div>
      </div>
    `;

    // 6. Tire imèl la ak Resend an itilize domèn ou a
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'HatexCard <notifications@hatexcard.com>',
        to: merchant.email,
        subject: `💸 Nouvo Kòmand HatexCard - #${order_id}`,
        html: emailHtml
      })
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error('Erè Resend API:', errorData);
    }

    return NextResponse.json({ 
        success: true, 
        message: 'Peman an pase e imèl la voye!'
    });

  } catch (error: any) {
    console.error("Direct API Error:", error);
    return NextResponse.json({ error: 'Erè nan sèvè HatexCard la.' }, { status: 500 });
  }
}