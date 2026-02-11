import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

// 1. HEADERS POU DEBLOKE CORS (Sa a ap ranje erè wouj yo)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Jere Preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    // Detekte si done a soti nan Database Webhook (record) oswa dirèk nan SDK
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
    // --- KA 2: KONFIMASYON PEMAN (Ansyen Lojik la) ---
    else if (table === 'transactions' && record.type === 'PAYMENT') {
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
    // --- KA 3: NOUVO! NOTIFIKASYON SDK (Sa ki te manke a) ---
    else if (record.transaction_id && record.sdk) {
      emailTo = "notifikasyon@hatexcard.com" // Mete imèl kote w vle resevwa detay livrezon yo
      emailSubject = `Livrezon nesesè: ${record.business_name}`
      emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; border: 2px solid #dc2626; border-radius: 15px;">
          <h2 style="color: #dc2626; text-transform: uppercase;">Nouvo Lòd Livrezon! 🚀</h2>
          <hr>
          <p><strong>Pwodwi:</strong> ${record.sdk.product_name}</p>
          <p><strong>Kantite:</strong> ${record.sdk.quantity}</p>
          <p><strong>Kliyan:</strong> ${record.sdk.customer_name}</p>
          <p><strong>Telefòn:</strong> ${record.sdk.customer_phone}</p>
          <p><strong>Adrès Livrezon:</strong> ${record.sdk.customer_address}</p>
          <p><strong>ID Tranzaksyon:</strong> ${record.transaction_id}</p>
          <div style="margin-top:20px; font-size:10px; color:#999;">Sit: ${record.sdk.platform}</div>
        </div>`
    }
    // --- KA 4: ANSYEN LOJIK POU LÒT KALITE TRANZAKSYON (Transfè, elatriye) ---
    else if (record.type === 'TRANSFER') {
       emailTo = record.receiver_email;
       emailSubject = "Ou resevwa yon transfè!";
       emailHtml = `<h2>Kòb moute!</h2><p>Ou resevwa ${record.amount} HTG.</p>`;
    }
    else {
      return new Response(JSON.stringify({ message: "Ignore: Event not supported" }), { headers: corsHeaders, status: 200 })
    }

    // RELE API RESEND
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'HatexCard <notifications@hatexcard.com>',
        to: emailTo,
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