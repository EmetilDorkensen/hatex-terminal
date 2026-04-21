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
    const { 
      merchant_api_key, amount_htg, order_id, 
      card_number, card_expiry, card_cvv, customer_info 
    } = body;

    if (!merchant_api_key || !card_number || !card_cvv) {
      return NextResponse.json({ error: 'Manke enfòmasyon kat la.' }, { status: 400 });
    }

    const { data: merchant, error: merchantErr } = await supabaseAdmin
      .from('profiles').select('id, account_status, email').eq('api_key', merchant_api_key).single();

    if (merchantErr || !merchant) return NextResponse.json({ error: 'Machann pa rekonèt.' }, { status: 404 });
    if (merchant.account_status === 'suspended') return NextResponse.json({ error: 'Kont machann sa bloke.' }, { status: 403 });

    const { data: paymentRequest, error: insertErr } = await supabaseAdmin
      .from('payment_requests')
      .insert([{ merchant_id: merchant.id, amount: Number(amount_htg), order_id: order_id, redirect_url: 'direct', webhook_url: 'direct' }])
      .select().single();

    if (insertErr) throw insertErr;

    const cleanCardNumber = card_number.replace(/\s/g, '');
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('process_merchant_payment_with_card', {
      p_payment_id: paymentRequest.id, p_card_number: cleanCardNumber, p_exp_date: card_expiry, p_cvv: card_cvv
    });

    if (rpcError || !result.success) return NextResponse.json({ error: result?.message || "Echèk nan verifye kat la." }, { status: 400 });

    await supabaseAdmin.from('plugin_transactions').insert([{
       merchant_id: merchant.id, amount_htg: Number(amount_htg), original_amount: Number(amount_htg),
       currency: 'HTG', order_id: order_id, customer_info: customer_info, status: 'completed'
    }]);

    // ========================================================================
    // 🚨 MAJI EMAIL LA: FOTO, VARYAB (SIZE/COLOR), AK ADRÈS KONPLÈ 🚨
    // ========================================================================
    const orderDate = new Date().toLocaleDateString('ht-HT', { year: 'numeric', month: 'long', day: 'numeric' });
    
    let productsHtml = '';
    if (customer_info.products && customer_info.products.length > 0) {
      customer_info.products.forEach((prod: any) => {
        // Pran foto a (si l pa genyen, li mete yon bwat gri)
        const imgSrc = prod.image ? prod.image : 'https://via.placeholder.com/50?text=No+Image';
        // Afiche varyab yo (Gwosè, Koulè) si yo egziste
        const metaHtml = prod.meta ? `<br><span style="color: #6b7280; font-size: 12px; display: inline-block; margin-top: 4px;">${prod.meta}</span>` : '';
        
        productsHtml += `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eaeaea; width: 65px;">
              <img src="${imgSrc}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover; border: 1px solid #eee;" alt="Pwodwi">
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #eaeaea; color: #333; line-height: 1.4;">
              <strong>${prod.name}</strong> <span style="color: #888;">× ${prod.qty}</span>
              ${metaHtml}
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eaeaea; text-align: right; color: #333; font-weight: 500;">
              ${prod.total} HTG
            </td>
          </tr>
        `;
      });
    }

    // WordPress voye adrès la ak espas, nou chanje l an vrè liy HTML (<br>)
    const formattedAddress = customer_info.address ? customer_info.address.replace(/\n/g, '<br>') : 'Pa gen adrès ki anrejistre';

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background: #fafafa; border: 1px solid #eee; border-radius: 10px;">
        <div style="background: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <h1 style="font-size: 22px; font-weight: 600; margin-top: 0; margin-bottom: 15px; color: #111;">Nouvo Kòmand resi via HatexCard</h1>
            <p style="color: #555; margin-bottom: 25px; font-size: 15px;">Felisitasyon! Ou fèk resevwa yon kòmand ki peye nèt.</p>

            <table style="width: 100%; margin-bottom: 30px; font-size: 14px; background: #f9fafb; padding: 15px; border-radius: 6px;">
              <tr>
                <td style="padding-bottom: 10px; color: #6b7280;">Kòmand: <br><strong style="color:#111; font-size:16px;">#${order_id}</strong></td>
                <td style="padding-bottom: 10px; color: #6b7280;">Dat: <br><strong style="color:#111;">${orderDate}</strong></td>
                <td style="padding-bottom: 10px; color: #6b7280;">Total: <br><strong style="color:#16a34a; font-size:16px;">${amount_htg} HTG</strong></td>
              </tr>
            </table>

            <h2 style="font-size: 18px; font-weight: 600; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; margin-bottom: 15px;">Detay pwodwi yo</h2>
            <table style="width: 100%; font-size: 14px; margin-bottom: 30px; border-collapse: collapse;">
              ${productsHtml}
              <tr>
                <td colspan="2" style="padding: 15px 0; font-weight: 600; text-align: right; color: #555;">Total Peye:</td>
                <td style="padding: 15px 0; text-align: right; font-weight: bold; font-size: 16px; color: #16a34a;">${amount_htg} HTG</td>
              </tr>
            </table>

            <h2 style="font-size: 18px; font-weight: 600; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; margin-bottom: 15px;">Kliyan & Livrezon</h2>
            <div style="background: #fdfdfd; border: 1px solid #eaeaea; padding: 15px; border-radius: 6px; font-size: 14px; color: #444; line-height: 1.6;">
              <strong style="font-size: 15px; color: #111;">${customer_info.name}</strong><br>
              ${formattedAddress}<br>
              <span style="display:inline-block; margin-top:8px; color: #6b7280;">📞 Telefòn:</span> <strong>${customer_info.phone}</strong><br>
              <span style="display:inline-block; color: #6b7280;">✉️ Imèl:</span> ${customer_info.email}
            </div>
        </div>
      </div>
    `;

    const resendData = await resend.emails.send({
      from: 'HatexCard <notifications@hatexcard.com>',
      to: merchant.email,
      subject: `💸 Nouvo Kòmand Peye - #${order_id}`,
      html: emailHtml
    });

    console.log("✅ Imèl la ale dous!", resendData);

    return NextResponse.json({ success: true, message: 'Peman an pase nèt!' });

  } catch (error: any) {
    console.error("🚨 Erè Jeneral nan API Direct Payment lan:", error);
    return NextResponse.json({ error: 'Erè nan sèvè HatexCard la.' }, { status: 500 });
  }
}