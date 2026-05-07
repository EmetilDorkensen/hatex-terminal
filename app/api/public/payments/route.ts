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

    // 1. Chèche Machann nan via Bearer Token
    const authHeader = req.headers.get('Authorization');
    const api_key = authHeader?.replace('Bearer ', '');
    
    const { data: merchant, error: mErr } = await supabaseAdmin
      .from('profiles').select('id, email, full_name, account_status')
      .eq('api_key', api_key).single();

    if (mErr || !merchant) return NextResponse.json({ error: 'Kle API machann nan pa bon.' }, { status: 401 });
    if (merchant.account_status === 'suspended') return NextResponse.json({ error: 'Kont machann sa a bloke.' }, { status: 403 });

    // 2. Kreye yon Kòd Sekrè 4 Chif (OTP) pou Livrezon an
    const delivery_otp = Math.floor(1000 + Math.random() * 9000).toString();

    // 3. Pwosesis Kat la (Nou rele RPC ou te genyen an)
    // Nou kreye yon request peman anvan
    const { data: pReq, error: pErr } = await supabaseAdmin.from('payment_requests').insert([{
      merchant_id: merchant.id, amount: Number(amount), order_id: order_id.toString()
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

    // 4. Sere tranzaksyon an nan Plugin Transactions ak Status 'pending' (Escrow)
    // Nou mete OTP a anndan customer_info
    const finalCustomerInfo = { ...customer_info, delivery_otp };

    await supabaseAdmin.from('plugin_transactions').insert([{
      merchant_id: merchant.id,
      amount_htg: Number(amount),
      currency: 'HTG',
      order_id: order_id.toString(),
      customer_info: finalCustomerInfo,
      status: 'pending' // 🚨 Bloke: Machann nan poko touche
    }]);

    // 5. KONSTRIKSYON IMÈL DETAYE A (AK FOTO AK VARYASYON)
    let productsHtml = '';
    if (customer_info.products_detail && customer_info.products_detail.length > 0) {
      customer_info.products_detail.forEach((prod: any) => {
        const imgSrc = prod.image ? prod.image : 'https://hatexcard.com/no-image.png';
        productsHtml += `
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; width: 60px;">
              <img src="${imgSrc}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 14px;">
              <strong style="color:#000;">${prod.name}</strong> x${prod.qty}
              <br><span style="color:#888; font-size:11px;">${prod.meta || ''}</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">
              $${prod.price_usd}
            </td>
          </tr>`;
      });
    }

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 15px;">
        <h2 style="color: #16a34a;">💰 Nouvo Kòmand #${order_id}</h2>
        <p>Ou resevwa yon peman <b>${amount} HTG</b>. Lajan an nan sistèm sekirite (Escrow).</p>
        
        <div style="background: #fffbeb; border: 1px dashed #f59e0b; padding: 15px; border-radius: 10px; text-align: center;">
          <p style="margin:0; font-size: 13px; color: #b45309;">Pou debloke kòb sa a, mande kliyan an kòd livrezon an:</p>
          <h1 style="margin: 5px 0; letter-spacing: 5px; color: #d97706;">****</h1>
          <p style="font-size: 10px;">(Kliyan an gen kòd sa a sou ekran li)</p>
        </div>

        <h3 style="border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 25px;">Pwodwi pou Livre:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${productsHtml}
        </table>

        <h3 style="border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 25px;">Enfòmasyon Livrezon:</h3>
        <p style="font-size: 14px; line-height: 1.6;">
          <b>Kliyan:</b> ${customer_info.name}<br>
          <b>Telefòn:</b> ${customer_info.phone}<br>
          <b>Adrès:</b> ${customer_info.address.replace(/\n/g, '<br>')}
        </p>
      </div>
    `;

    await resend.emails.send({
      from: 'HatexCard Orders <orders@hatexcard.com>',
      to: merchant.email,
      subject: `🛍️ Kòmand Nouvo #${order_id} - ${amount} HTG`,
      html: emailHtml
    });

    // 6. RETOUNEN OTP A BAY PLUGIN NAN POU L KA AFICHE L BAY KLIYAN AN
    return NextResponse.json({ 
      success: true, 
      delivery_otp: delivery_otp 
    });

  } catch (error: any) {
    return NextResponse.json({ error: 'Erè Sèvè: ' + error.message }, { status: 500 });
  }
}