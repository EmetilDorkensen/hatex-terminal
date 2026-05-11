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

    if (!amount || !order_id || !card_info || !card_info.number) {
        return NextResponse.json({ error: 'Manke enfòmasyon peman an.' }, { status: 400 });
    }

    // 1. VERIFIKASYON AK KRIPTAJ KLE MACHANN NAN
    const authHeader = req.headers.get('Authorization');
    const api_key = authHeader?.replace('Bearer ', '');
    
    const { data: merchant, error: mErr } = await supabaseAdmin
      .from('profiles').select('id, email, full_name, account_status, wallet_balance')
      .eq('api_key', api_key).single();

    if (mErr || !merchant) return NextResponse.json({ error: 'Kle API machann nan pa bon oswa li pa verifye.' }, { status: 401 });
    if (merchant.account_status === 'suspended') return NextResponse.json({ error: 'Kont machann sa a bloke pou rezon sekirite.' }, { status: 403 });

    // 2. KREYE OTP A POU BANK GLOBAL LA
    const delivery_otp = Math.floor(1000 + Math.random() * 9000).toString();

    // 3. ANREJISTRE DEMANN PEMAN AN (POU TRASABILITE)
    const { data: pReq, error: pErr } = await supabaseAdmin.from('payment_requests').insert([{
      merchant_id: merchant.id, 
      amount: Number(amount), 
      order_id: order_id.toString(),
      redirect_url: 'direct', 
      webhook_url: 'direct'   
    }]).select().single();

    if (pErr) throw pErr;

    // 4. KOUPE KÒB LA SOU KAT LA AK RPC (Sistèm Kriptaj la)
    const { data: cardResult, error: rpcErr } = await supabaseAdmin.rpc('process_merchant_payment_with_card', {
      p_payment_id: pReq.id,
      p_card_number: card_info.number.replace(/\s/g, ''),
      p_exp_date: card_info.exp,
      p_cvv: card_info.cvv
    });

    if (rpcErr || !cardResult.success) {
      return NextResponse.json({ error: cardResult?.message || 'Kat la refize. Tcheke enfòmasyon yo.' }, { status: 400 });
    }

    // 🚨 5. MAJI ESCROW (BANK GLOBAL LA): NOU KACHE KÒB LA! 🚨
    // Piske RPC a te eseye bay machann nan kòb la otomatik, nou wete l touswit pou l ka rete nan "Pending"
    const { data: currentMerchant } = await supabaseAdmin.from('profiles').select('wallet_balance').eq('id', merchant.id).single();
    const currentBalance = currentMerchant ? Number(currentMerchant.wallet_balance) : 0;
    
    await supabaseAdmin.from('profiles').update({ 
      wallet_balance: currentBalance - Number(amount) 
    }).eq('id', merchant.id);
    // 6. ANREJISTRE TRANZAKSYON AN POU MACHANN NAN KA WÈ L (ESTATI: PENDING)
    const finalCustomerInfo = { 
        ...customer_info, 
        delivery_otp_code: delivery_otp 
    };

    await supabaseAdmin.from('plugin_transactions').insert([{
      merchant_id: merchant.id,
      amount_htg: Number(amount),
      original_amount: Number(amount),
      currency: 'HTG',
      order_id: order_id.toString(),
      customer_info: finalCustomerInfo,
      status: 'pending' // Kòb la bloke nan Bank Global
    }]);

    // ========================================================================
    // 🚨 7. BATI GWO IMÈL LA AK TOUT DETAY YO (FOTO, SIZE, ADRÈS KONPLÈ) 🚨
    // ========================================================================
    const orderDate = new Date().toLocaleDateString('ht-HT', { year: 'numeric', month: 'long', day: 'numeric' });
    let productsHtml = '';
    
    if (customer_info.products && customer_info.products.length > 0) {
      customer_info.products.forEach((prod: any) => {
        const imgSrc = prod.image ? prod.image : 'https://via.placeholder.com/50?text=No+Image';
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
              $${prod.total || '0.00'}
            </td>
          </tr>
        `;
      });
    }

    const formattedAddress = customer_info.address ? customer_info.address.replace(/\n/g, '<br>') : 'Pa gen adrès ki anrejistre';

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background: #fafafa; border: 1px solid #eee; border-radius: 10px;">
        <div style="background: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <h1 style="font-size: 22px; font-weight: 600; margin-top: 0; margin-bottom: 15px; color: #111;">Nouvo Kòmand via HatexCard</h1>
            <p style="color: #555; margin-bottom: 25px; font-size: 15px;">Felisitasyon! Yon kliyan fèk peye <b>${amount} HTG</b>. Lajan an nan sistèm sekirite (Bank Global).</p>

            <div style="background: #fffbeb; border: 1px dashed #f59e0b; padding: 15px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <p style="margin:0; font-size: 13px; color: #b45309; text-transform: uppercase; font-weight: bold;">Pou debloke kòb la sou kont ou:</p>
              <h1 style="margin: 5px 0; letter-spacing: 8px; color: #d97706; font-size: 30px;">****</h1>
              <p style="font-size: 11px; color: #92400e; margin: 0;">(Antre ID Kòmand lan ak Kòd 4 chif kliyan an ba ou a nan tèminal ou a)</p>
            </div>

            <table style="width: 100%; margin-bottom: 30px; font-size: 14px; background: #f9fafb; padding: 15px; border-radius: 6px;">
              <tr>
                <td style="padding-bottom: 10px; color: #6b7280;">Kòmand: <br><strong style="color:#111; font-size:16px;">#${order_id}</strong></td>
                <td style="padding-bottom: 10px; color: #6b7280;">Dat: <br><strong style="color:#111;">${orderDate}</strong></td>
                <td style="padding-bottom: 10px; color: #6b7280;">Total: <br><strong style="color:#16a34a; font-size:16px;">${amount} HTG</strong></td>
              </tr>
            </table>

            <h2 style="font-size: 18px; font-weight: 600; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; margin-bottom: 15px;">Detay pwodwi yo</h2>
            <table style="width: 100%; font-size: 14px; margin-bottom: 30px; border-collapse: collapse;">
              ${productsHtml}
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

    if (process.env.RESEND_API_KEY) {
        await resend.emails.send({
          from: 'HatexCard <notifications@hatexcard.com>',
          to: merchant.email,
          subject: `💸 Nouvo Kòmand #${order_id} - Aksyon Obligatwa`,
          html: emailHtml
        });
    }

    return NextResponse.json({ 
      success: true, 
      delivery_otp: delivery_otp 
    });

  } catch (error: any) {
    console.error("🚨 Erè Jeneral nan API Direct Payment lan:", error);
    return NextResponse.json({ error: 'Erè nan sèvè HatexCard la: ' + error.message }, { status: 500 });
  }
}