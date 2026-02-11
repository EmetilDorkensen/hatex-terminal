import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json()
    const record = payload.record || payload 
    const table = payload.table 

    let emailTo = ""
    let emailSubject = ""
    let emailHtml = ""

    // --- KA 1: VOYE INVOICE (Tab: invoices) ---
    if (table === 'invoices') {
      emailTo = record.client_email
      emailSubject = `Invoice HatexCard: ${record.amount} HTG pou ${record.business_name}`
      emailHtml = `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; border: 1px solid #e0e0e0; border-radius: 20px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #000; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-style: italic;">HATEX<span style="color: #dc2626;">CARD</span></h1>
          </div>
          <div style="padding: 40px; text-align: center;">
            <p style="text-transform: uppercase; font-size: 12px; color: #666; font-weight: bold; letter-spacing: 2px;">Bòdro Peman</p>
            <h2 style="color: #111; margin: 10px 0;">${record.business_name} voye yon invoice ba ou</h2>
            <div style="background-color: #f9f9f9; padding: 25px; border-radius: 15px; margin: 25px 0;">
              <h1 style="margin: 5px 0; font-size: 36px; color: #000;">${record.amount} HTG</h1>
            </div>
            <a href="https://hatexcard.com/checkout?invoice_id=${record.id}" style="display: block; background-color: #dc2626; color: #ffffff; padding: 20px; border-radius: 12px; text-decoration: none; font-weight: 900;">KLIKE POU PEYE</a>
          </div>
        </div>`
    } 
    // --- KA 2: KONFIMASYON PEMAN (Standard) ---
    else if (table === 'transactions' && record.type === 'PAYMENT' && !record.sdk) {
      emailTo = record.customer_email
      emailSubject = `Konfimasyon Peman - ${record.description}`
      emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #000; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-style: italic;">HATEX<span style="color: #dc2626;">CARD</span></h1>
          </div>
          <div style="padding: 40px;">
            <h2>Peman Reyisi! ✅</h2>
            <p>Ou fè yon peman nan <strong>${record.description}</strong>.</p>
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
              <p><strong>Montan:</strong> ${Math.abs(record.amount).toLocaleString()} HTG</p>
              <p><strong>Dat:</strong> ${new Date(record.created_at).toLocaleString()}</p>
            </div>
          </div>
        </div>`
    }
    // --- KA 3: NOTIFIKASYON SDK (LIVREZON) - VOYE 2 IMÈL ---
    else if (record.transaction_id && record.sdk) {
      
      // A) HTML POU MACHANN (Detay konplè livrezon)
      const merchantHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 2px solid #dc2626; border-radius: 15px; overflow: hidden;">
          <div style="background-color: #dc2626; padding: 20px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; text-transform: uppercase;">Nouvo Komand Livrezon! 🚀</h2>
          </div>
          <div style="padding: 30px;">
            <p style="color: #666; font-size: 12px; text-transform: uppercase;"><strong>Sous:</strong> ${record.sdk.platform || 'SDK'}</p>
            <h3 style="margin-top: 5px;">${record.sdk.product_name}</h3>
            ${record.sdk.product_image ? `<img src="${record.sdk.product_image}" style="width: 150px; border-radius: 10px; margin-bottom: 20px;" />` : ''}
            
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 10px;">
              <p style="margin: 5px 0;"><strong>Kliyan:</strong> ${record.sdk.customer_name}</p>
              <p style="margin: 5px 0;"><strong>Telefòn:</strong> ${record.sdk.customer_phone}</p>
              <p style="margin: 5px 0;"><strong>Adrès:</strong> ${record.sdk.customer_address}</p>
              <p style="margin: 5px 0;"><strong>Kantite:</strong> ${record.sdk.quantity}</p>
            </div>
            <p style="font-size: 11px; color: #999; margin-top: 20px;">Tranzaksyon: ${record.transaction_id}</p>
          </div>
        </div>`;

      // B) HTML POU KLIYAN (Konfimasyon acha)
      const customerHtml = `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; text-align: center; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
          <h1 style="font-style: italic;">HATEX<span style="color: #dc2626;">CARD</span></h1>
          <h2 style="color: #222;">Mèsi pou acha w la! ✅</h2>
          <p style="color: #666;">Ou sot achte <strong>${record.sdk.product_name}</strong> nan men <strong>${record.business_name}</strong>.</p>
          <div style="margin: 20px 0; padding: 15px; background: #fdf2f2; border-radius: 10px; color: #dc2626; font-weight: bold;">
            Montan: ${record.amount || '---'} HTG <br>
            Kantite: ${record.sdk.quantity} <br>
            Dat: ${new Date().toLocaleDateString()}
          </div>
          <p style="font-size: 12px; color: #999;">Machann nan resevwa detay livrezon ou yo epi l ap kontakte w talè.</p>
        </div>`;

      // 1. Voye bay Machann nan
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'HatexCard <notifications@hatexcard.com>',
          to: record.sdk.merchant_email || "notifikasyon@hatexcard.com",
          subject: `Livrezon Nesesè (${record.sdk.platform}): ${record.sdk.product_name}`,
          html: merchantHtml
        }),
      });

      // 2. Voye bay Kliyan an
      if (record.sdk.customer_email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'HatexCard <notifications@hatexcard.com>',
            to: record.sdk.customer_email,
            subject: `Acha reyisi nan ${record.business_name}`,
            html: customerHtml
          }),
        });
      }
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 });
    }
    else {
      return new Response(JSON.stringify({ message: "Ignore: Event not supported" }), { headers: corsHeaders, status: 200 })
    }

    // Ekzekisyon pou KA 1 ak KA 2
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'HatexCard <notifications@hatexcard.com>',
        to: emailTo || "notifikasyon@hatexcard.com",
        subject: emailSubject,
        html: emailHtml,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), { headers: corsHeaders, status: 200 })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 })
  }
})