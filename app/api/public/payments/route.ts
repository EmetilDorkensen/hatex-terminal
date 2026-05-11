import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    const body = await req.json();
    const { amount, currency, order_id, card_info, customer_info } = body;

    const authHeader = req.headers.get('Authorization');
    const api_key = authHeader?.replace('Bearer ', '');
    
    const { data: merchant, error: mErr } = await supabaseAdmin
      .from('profiles').select('id, email, full_name, account_status')
      .eq('api_key', api_key).single();

    if (mErr || !merchant) return NextResponse.json({ error: 'Kle API machann nan pa bon.' }, { status: 401 });
    if (merchant.account_status === 'suspended') return NextResponse.json({ error: 'Kont ou bloke.' }, { status: 403 });

    // 🚨 KREYE OTP A (4 CHIF)
    const delivery_otp = Math.floor(1000 + Math.random() * 9000).toString();

    // PWOSESIS KAT LA
    const { data: pReq, error: pErr } = await supabaseAdmin.from('payment_requests').insert([{
      merchant_id: merchant.id, 
      amount: Number(amount), 
      order_id: order_id.toString(),
      redirect_url: 'direct', 
      webhook_url: 'direct'   
    }]).select().single();

    if (pErr) throw pErr;

    const { data: cardResult, error: rpcErr } = await supabaseAdmin.rpc('process_merchant_payment_with_card', {
      p_payment_id: pReq.id,
      p_card_number: card_info.number.replace(/\s/g, ''),
      p_exp_date: card_info.exp,
      p_cvv: card_info.cvv
    });

    if (rpcErr || !cardResult.success) {
      return NextResponse.json({ error: cardResult?.message || 'Kat la refize.' }, { status: 400 });
    }

    // 🚨 STOKE NAN "BANK GLOBAL" LA (Escrow)
    // Nou fòse OTP a antre nan customer_info a byen klè
    const finalCustomerInfo = { 
        ...customer_info, 
        delivery_otp_code: delivery_otp 
    };

    await supabaseAdmin.from('plugin_transactions').insert([{
      merchant_id: merchant.id,
      amount_htg: Number(amount),
      currency: 'HTG',
      order_id: order_id.toString(), // Egzanp: "74"
      customer_info: finalCustomerInfo,
      status: 'pending' // Kòb la rete nan bank global la, li poko sou kont machann nan
    }]);

    // 🚨 BATI IMÈL LA AK TOUT DETAY PWODWI YO
    let productsHtml = '';
    // Nou asire n ap sèvi ak 'products' ki soti nan WooCommerce la
    if (customer_info.products && customer_info.products.length > 0) {
      customer_info.products.forEach((prod: any) => {
        const imgSrc = prod.image ? prod.image : 'https://via.placeholder.com/50?text=No+Image';
        productsHtml += `
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; width: 60px;">
              <img src="${imgSrc}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; border: 1px solid #eee;">
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 14px;">
              <strong style="color:#000;">${prod.name}</strong> x${prod.qty}
              <br><span style="color:#888; font-size:11px;">${prod.meta || ''}</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">
              $${prod.total || '0.00'}
            </td>
          </tr>`;
      });
    }

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 15px;">
        <h2 style="color: #16a34a;">💰 Nouvo Kòmand #${order_id}</h2>
        <p>Ou resevwa yon peman <b>${amount} HTG</b>. Lajan an nan sistèm sekirite (Bank Global la).</p>
        
        <div style="background: #fffbeb; border: 1px dashed #f59e0b; padding: 15px; border-radius: 10px; text-align: center;">
          <p style="margin:0; font-size: 13px; color: #b45309;">Pou debloke kòb sa a sou kont ou, antre kòd livrezon an nan tèminal ou a:</p>
          <h1 style="margin: 5px 0; letter-spacing: 5px; color: #d97706;">****</h1>
          <p style="font-size: 10px;">(Lè w rive nan adrès la, mande kliyan an kòd 4 chif li a)</p>
        </div>

        <h3 style="border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 25px;">Pwodwi pou Livre:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${productsHtml}
        </table>

        <h3 style="border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 25px;">Enfòmasyon Livrezon:</h3>
        <p style="font-size: 14px; line-height: 1.6;">
          <b>Kliyan:</b> ${customer_info.name}<br>
          <b>Telefòn:</b> ${customer_info.phone}<br>
          <b>Adrès:</b> ${customer_info.address ? customer_info.address.replace(/\n/g, '<br>') : ''}
        </p>
      </div>
    `;

    if (process.env.RESEND_API_KEY) {
        await resend.emails.send({
          from: 'HatexCard Orders <orders@hatexcard.com>',
          to: merchant.email,
          subject: `🛍️ Kòmand Nouvo #${order_id} - ${amount} HTG`,
          html: emailHtml
        });
    }

    return NextResponse.json({ 
      success: true, 
      delivery_otp: delivery_otp 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}