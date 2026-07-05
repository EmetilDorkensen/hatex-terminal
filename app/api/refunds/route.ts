import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = await rateLimit(`refunds:${ip}`, 20, 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Twòp demann. Eseye ankò.' }, { status: 429 });
    }

    // 🔐 OTANTIFIKASYON OBLIGATWA: se sèlman machann ki gen kle API valab la
    // (Bearer token) ki ka mande yon ranbousman — `merchant_id` PA JANM dwe
    // soti nan kò rekèt la, sinon nenpòt moun ka fòse yon ranbousman.
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Aksè refize. Kle API (Bearer Token) manke oswa li pa fòmate byen.' }, { status: 401 });
    }
    const apiKey = authHeader.split(' ')[1].trim();

    const resend = new Resend(process.env.RESEND_API_KEY);
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    const { data: merchant, error: merchantErr } = await supabaseAdmin
      .from('profiles')
      .select('id, is_merchant, account_status')
      .eq('api_key', apiKey)
      .single();

    if (merchantErr || !merchant || !merchant.is_merchant) {
      return NextResponse.json({ error: 'Kle API sa a pa valab oswa kont lan pa otorize.' }, { status: 403 });
    }
    if (merchant.account_status === 'suspended') {
      return NextResponse.json({ error: 'Kont machann sa a pa aktif.' }, { status: 403 });
    }

    const merchant_id = merchant.id;

    const body = await req.json();
    const { transaction_id, reason } = body;

    if (!transaction_id) {
      return NextResponse.json({ error: 'Manke enfòmasyon pou tranzaksyon an.' }, { status: 400 });
    }

    // 1. CHÈCHE TRANZAKSYON AN EPI TCHEKE SI L POKO RANBOUSE
    //    (`.eq('merchant_id', merchant_id)` la a se garanti ki anpeche yon
    //    machann ranbouse yon tranzaksyon ki pa pou li — machann_id soti
    //    dirèkteman nan kle API otantifye a, pa nan kò rekèt la.)
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('plugin_transactions')
      .select('*, profiles:merchant_id(email, full_name, wallet_balance)')
      .eq('id', transaction_id)
      .eq('merchant_id', merchant_id)
      .single();

    if (txError || !transaction) return NextResponse.json({ error: 'Tranzaksyon sa pa egziste oswa li pa apatyen a kont ou.' }, { status: 404 });
    if (transaction.status === 'refunded') return NextResponse.json({ error: 'Kòb sa te gentan ranbouse deja.' }, { status: 400 });

    const refundAmount = Number(transaction.amount_htg);

    // 2. TCHEKE SI MACHANN NAN GEN ASE KÒB POU L REMÈT LAJAN AN
    //    (🔧 Korije: machann kredite sou `wallet_balance` pa /api/public/payments
    //    ak RPC peman an, se sa ki dwe debite isit la — pa `card_balance`.)
    const merchantBalance = Number(transaction.profiles.wallet_balance || 0);
    if (merchantBalance < refundAmount) {
      return NextResponse.json({ error: 'Ou pa gen ase kòb sou kont ou pou w fè ranbousman sa a.' }, { status: 400 });
    }

    // 3. FÈ MAJI A: RALE KÒB LA SOU MACHANN NAN, VOYE L BAY KLIYAN AN
    // Rale kòb la nan men Machann nan
    await supabaseAdmin.from('profiles')
      .update({ wallet_balance: merchantBalance - refundAmount })
      .eq('id', merchant_id);

    // Chèche kliyan an (Si l te anrejistre kòm user nan sistèm ou an)
    // Nou sipoze customer_info gen yon imèl oswa yon id. Si se yon kat, nou mete l sou kat la.
    const clientEmail = transaction.customer_info?.email;
    if (clientEmail) {
      const { data: clientData } = await supabaseAdmin.from('profiles').select('id, card_balance').eq('email', clientEmail).single();
      if (clientData) {
         await supabaseAdmin.from('profiles')
           .update({ card_balance: Number(clientData.card_balance || 0) + refundAmount })
           .eq('id', clientData.id);
      }
    }

    // 4. METE TRANZAKSYON AN AJOU KÒM "REFUNDED"
    await supabaseAdmin.from('plugin_transactions')
      .update({ 
        status: 'refunded', 
        refund_reason: reason || 'Kliyan an mande ranbousman',
        refunded_at: new Date().toISOString()
      })
      .eq('id', transaction_id);

    // 5. VOYE IMÈL RESI RANBOUSMAN AN BAY KLIYAN AN (Style Amazon)
    if (clientEmail) {
      const refundDate = new Date().toLocaleDateString('ht-HT', { year: 'numeric', month: 'long', day: 'numeric' });
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #16a34a; text-align: center;">Ranbousman w lan fèt!</h2>
          <p style="color: #333;">Bonjou,</p>
          <p style="color: #555;">Machann <strong>${transaction.profiles.full_name}</strong> fèk ranbouse w pou kòmand <strong>#${transaction.order_id}</strong> la.</p>
          
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Kantite:</strong> <span style="color: #16a34a; font-size: 18px; font-weight: bold;">${refundAmount} HTG</span></p>
            <p style="margin: 5px 0;"><strong>Rezon:</strong> ${reason || 'Pa presize'}</p>
            <p style="margin: 5px 0;"><strong>Dat:</strong> ${refundDate}</p>
          </div>
          
          <p style="color: #555; font-size: 14px;">Lajan an gentan retounen sou balans HatexCard ou a. Ou ka itilize l touswit!</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="color: #888; font-size: 12px; text-align: center;">Sistèm peman sekirize pa HatexCard.</p>
        </div>
      `;

      await resend.emails.send({
        from: 'HatexCard <notifications@hatexcard.com>',
        to: clientEmail,
        subject: `Ranbousman: ${refundAmount} HTG soti nan ${transaction.profiles.full_name}`,
        html: emailHtml
      });
    }

    return NextResponse.json({ success: true, message: 'Ranbousman an pase nèt!' });

  } catch (error: any) {
    console.error("Erè API Ranbousman:", error);
    return NextResponse.json({ error: 'Erè nan sèvè a pandan ranbousman an.' }, { status: 500 });
  }
}