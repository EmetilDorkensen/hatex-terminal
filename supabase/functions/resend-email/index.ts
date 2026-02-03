import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const record = payload.record 
    const table = payload.table // Sa pèmèt nou konnen si se tab 'invoices' oswa 'transactions'

    let emailTo = ""
    let emailSubject = ""
    let emailHtml = ""

    // --- KA 1: VOYE INVOICE BAY KLIYAN (Tab: invoices) ---
    if (table === 'invoices') {
      emailTo = record.client_email
      emailSubject = `Invoice HatexCard: ${record.amount} HTG pou ${record.business_name}`
      emailHtml = `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #e0e0e0; border-radius: 20px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #000; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-style: italic;">HATEX<span style="color: #dc2626;">CARD</span></h1>
          </div>
          <div style="padding: 40px; text-align: center;">
            <p style="text-transform: uppercase; font-size: 12px; color: #666; font-weight: bold; letter-spacing: 2px;">Bòdro Peman</p>
            <h2 style="color: #111; margin: 10px 0;">${record.business_name} voye yon invoice ba ou</h2>
            
            <div style="background-color: #f9f9f9; padding: 25px; border-radius: 15px; margin: 25px 0;">
              <span style="color: #666; font-size: 14px;">Montan pou peye:</span>
              <h1 style="margin: 5px 0; font-size: 36px; color: #000;">${record.amount} <span style="font-size: 18px;">HTG</span></h1>
            </div>

            <a href="https://hatexcard.com/checkout?invoice_id=${record.id}" 
               style="display: block; background-color: #dc2626; color: #ffffff; padding: 20px; border-radius: 12px; text-decoration: none; font-weight: 900; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
               KLIKE POU PEYE KOUNYE A
            </a>
            
            <p style="font-size: 12px; color: #999; margin-top: 30px;">Si ou gen keksyon, kontakte sipò HatexCard nan support@hatexcard.com</p>
          </div>
        </div>`
    } 
    // --- KA 2: KONFIMASYON PEMAN TERMINAL (Tab: transactions) ---
    else if (table === 'transactions' && record.type === 'PAYMENT') {
      emailTo = record.customer_email
      emailSubject = `Konfimasyon Peman - ${record.description}`
      emailHtml = `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #000; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-style: italic;">HATEX<span style="color: #dc2626;">CARD</span></h1>
          </div>
          <div style="padding: 40px; color: #333;">
            <h2 style="color: #111; margin-top: 0;">Peman Reyisi! ✅</h2>
            <p>Bonjou, nou konfime ke peman ou an te fèt avèk siksè nan <strong>${record.description}</strong>.</p>
            
            <div style="background-color: #f9f9f9; padding: 25px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #dc2626;">
              <p style="margin: 0 0 10px 0;"><strong>💰 Montan:</strong> ${Math.abs(record.amount).toLocaleString()} HTG</p>
              <p style="margin: 0 0 10px 0;"><strong>🆔 Tranzaksyon:</strong> #${Math.floor(Math.random() * 1000000)}</p>
              <p style="margin: 0;"><strong>📅 Dat:</strong> ${new Date(record.created_at).toLocaleString('fr-FR')}</p>
            </div>
            
            <p style="font-size: 12px; color: #999; text-align: center;">© 2026 HatexCard. Sekirite w se priyorite nou.</p>
          </div>
        </div>`
    } else {
      return new Response(JSON.stringify({ message: "Ignore: Event not supported" }), { status: 200 })
    }

    // RELE API RESEND LA
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