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
    const { transaction_id, merchant_id, otp_code } = body;

    if (!transaction_id || !merchant_id || !otp_code) {
      return NextResponse.json({ error: 'Manke enfòmasyon (ID Tranzaksyon, Machann, oswa Kòd).' }, { status: 400 });
    }

    // 1. CHÈCHE MACHANN NAN POU WÈ SI L PA BLOKE DEJA EPI PRAN KANTITE ECHÈK LI YO
    const { data: merchant, error: merchantErr } = await supabaseAdmin
      .from('profiles')
      .select('id, account_status, failed_otp_attempts, wallet_balance, full_name, email')
      .eq('id', merchant_id)
      .single();

    if (merchantErr || !merchant) return NextResponse.json({ error: 'Machann pa rekonèt.' }, { status: 404 });
    if (merchant.account_status === 'suspended') {
      return NextResponse.json({ error: 'Kont ou sispandi pou rezon sekirite. Kontakte admin nan.' }, { status: 403 });
    }

    // 2. CHÈCHE TRANZAKSYON AN NAN BAZ DONE A
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('plugin_transactions')
      .select('*')
      .eq('id', transaction_id)
      .eq('merchant_id', merchant_id)
      .single();

    if (txError || !transaction) return NextResponse.json({ error: 'Tranzaksyon sa pa egziste.' }, { status: 404 });
    
    // Si l te gentan verifye deja
    if (transaction.status === 'delivered') {
      return NextResponse.json({ error: 'Kòmand sa a te gentan verifye e lajan an sou kont ou deja.' }, { status: 400 });
    }

    // 3. TCHEKE SI KÒD OTP A KORESPONN AK SA K NAN BAZ DONE A
    const correctOtp = transaction.customer_info?.delivery_otp;
    const currentFailures = merchant.failed_otp_attempts || 0;

    if (otp_code !== correctOtp) {
      // ❌ KÒD LA PA BON (MAJI ANTI-FRAUD LA ANTRE AN JWÈT)
      const newFailures = currentFailures + 1;

      if (newFailures >= 3) {
        // MACHANN NAN RIVE NAN 3 ECHÈK -> NOU BLOKE KONT LI
        await supabaseAdmin.from('profiles')
          .update({ account_status: 'suspended', failed_otp_attempts: newFailures })
          .eq('id', merchant_id);

        // VOYE ALÈT BAY ADMIN HATEXCARD (OU MENM)
        await resend.emails.send({
          from: 'HatexCard Security <security@hatexcard.com>',
          to: 'hatexcard@gmail.com', // Imèl Admin ou an
          subject: '🚨 ALÈT SEKIRITE: Kont Sispandi pou Frod',
          html: `<p>Sistèm nan fèk bloke otomatikman machann <strong>${merchant.full_name} (${merchant.email})</strong>.</p>
                 <p>Li eseye devine kòd sekrè livrezon kliyan an 3 fwa epi l rate pou tranzaksyon <b>${transaction_id}</b>.</p>
                 <p>Tanpri verifye kont sa a nan baz done a.</p>`
        });

        return NextResponse.json({ 
          error: 'Ou antre move kòd 3 fwa. Yo sispann kont ou otomatikman pou sispèk frod.' 
        }, { status: 403 });
      } else {
        // POKO RIVE NAN 3 -> NOU BA L AVÈTISMAN AN
        await supabaseAdmin.from('profiles')
          .update({ failed_otp_attempts: newFailures })
          .eq('id', merchant_id);

        const attemptsLeft = 3 - newFailures;
        return NextResponse.json({ 
          error: `Kòd la pa bon! Atansyon: Ou rete ${attemptsLeft} chans anvan kont ou bloke nèt.` 
        }, { status: 400 });
      }
    }

    // =========================================================================
    // ✅ KÒD LA BON (LIVREZON AN KONFIME: NOU BA L LAJAN AN)
    // =========================================================================

    const transactionAmount = Number(transaction.amount_htg);
    const newBalance = Number(merchant.wallet_balance || 0) + transactionAmount;

    // A. Nou mete lajan an nan balans li, epi nou reset erè yo a zewo
    await supabaseAdmin.from('profiles')
      .update({ 
        wallet_balance: newBalance,
        failed_otp_attempts: 0 // Nou efase ansyen erè li yo paske fwa sa l onèt
      })
      .eq('id', merchant_id);

    // B. Nou chanje estati tranzaksyon an fè l vin 'delivered'
    await supabaseAdmin.from('plugin_transactions')
      .update({ status: 'delivered' })
      .eq('id', transaction_id);

    return NextResponse.json({ 
      success: true, 
      message: 'Kòd la bon! Lajan an fèk ajoute sou balans ou.',
      new_balance: newBalance
    });

  } catch (error: any) {
    console.error("Erè Verify Delivery API:", error);
    return NextResponse.json({ error: 'Sèvè a rankontre yon pwoblèm.' }, { status: 500 });
  }
}