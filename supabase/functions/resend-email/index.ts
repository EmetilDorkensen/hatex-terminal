import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Jere CORS pou fwonntend lan ka rele fonksyon an
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const record = payload.record 

    // Sèlman si se yon peman (PAYMENT)
    if (!record || record.type !== 'PAYMENT') {
      return new Response(JSON.stringify({ message: "Ignore: Not a payment" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Rele API Resend pou voye imèl la
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'HatexCard <notifications@hatexcard.com>',
        to: record.customer_email,
        subject: `Konfimasyon Peman - ${record.description}`,
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #000; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-style: italic; letter-spacing: -1px;">HATEX<span style="color: #dc2626;">CARD</span></h1>
            </div>
            
            <div style="padding: 40px; color: #333; line-height: 1.6;">
              <h2 style="color: #111; margin-top: 0;">Peman Reyisi!</h2>
              <p>Bonjou, nou konfime ke peman ou an te fèt avèk siksè nan <strong>${record.description}</strong>.</p>
              
              <div style="background-color: #f9f9f9; padding: 25px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #dc2626;">
                <p style="margin: 0 0 10px 0;"><strong>💰 Montan:</strong> ${Math.abs(record.amount).toLocaleString()} HTG</p>
                <p style="margin: 0 0 10px 0;"><strong>🆔 Nimewo Tranzaksyon:</strong> #${Math.floor(Math.random() * 1000000)}</p>
                <p style="margin: 0;"><strong>📅 Dat:</strong> ${new Date(record.created_at).toLocaleString('fr-FR')}</p>
              </div>
              
              <p style="font-size: 14px; color: #666;">Si ou gen nenpòt keksyon, tanpri kontakte sipò nou nan support@hatexcard.com.</p>
            </div>
            
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #999;">
              <p>© 2026 HatexCard. Tout dwa rezève. <br> Sekirite w se priyorite nou.</p>
            </div>
          </div>
        `,
      }),
    })

    const data = await res.json()
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})