import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    const body = await req.json();
    const { transaction_id, merchant_id, otp_code, developer_webhook_url } = body;

    if (!transaction_id || !merchant_id || !otp_code) {
      return NextResponse.json({ error: 'Manke ID kòmand oswa Kòd OTP.' }, { status: 400 });
    }

    const cleanId = transaction_id.toString().replace('#', '').trim();

    const { data: merchant, error: mErr } = await supabaseAdmin
      .from('profiles').select('id, wallet_balance, account_status, failed_otp_attempts').eq('id', merchant_id).single();

    if (mErr || !merchant) return NextResponse.json({ error: 'Machann pa rekonèt.' }, { status: 404 });
    if (merchant.account_status === 'suspended') return NextResponse.json({ error: 'Kont ou bloke pou fwod. Kontakte sipò.' }, { status: 403 });

    const { data: tx, error: txErr } = await supabaseAdmin
      .from('plugin_transactions').select('*').eq('order_id', cleanId).eq('merchant_id', merchant_id).maybeSingle();

    if (txErr || !tx) return NextResponse.json({ error: `Kòmand #${cleanId} la pa egziste.` }, { status: 404 });
    if (tx.status === 'delivered') return NextResponse.json({ error: 'Lajan sa te gentan debloke deja.' }, { status: 400 });

    const storedOtp = tx.customer_info?.delivery_otp_code;
    const currentFailures = merchant.failed_otp_attempts || 0;

    if (otp_code.trim() !== String(storedOtp)) {
      const newFailures = currentFailures + 1;
      if (newFailures >= 3) {
        await supabaseAdmin.from('profiles').update({ account_status: 'suspended', failed_otp_attempts: newFailures }).eq('id', merchant_id);
        return NextResponse.json({ error: 'Ou rate 3 fwa. Kont ou sispann otomatikman.' }, { status: 403 });
      }
      await supabaseAdmin.from('profiles').update({ failed_otp_attempts: newFailures }).eq('id', merchant_id);
      return NextResponse.json({ error: `Kòd OTP a pa bon! Ou rete ${3 - newFailures} chans.` }, { status: 400 });
    }

    // ✅ KÒD LA BON: DEBLOKE LAJAN AN
    const amountToRelease = Number(tx.amount_htg);
    const newBalance = Number(merchant.wallet_balance || 0) + amountToRelease;

    await supabaseAdmin.from('profiles').update({ wallet_balance: newBalance, failed_otp_attempts: 0 }).eq('id', merchant_id);
    await supabaseAdmin.from('plugin_transactions').update({ status: 'delivered' }).eq('id', tx.id);

    // 🚨 MAJI WEBHOOK LA POU DEVLOPÈ YO 🚨
    // Si devlopè a te pase yon URL nan kòd li a, sistèm nan ap voye yon mesaj ba li an kachèt
    if (developer_webhook_url) {
      try {
        await fetch(developer_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'delivery.verified',
            order_id: cleanId,
            amount: amountToRelease,
            status: 'success',
            message: 'Lajan an fèk debloke nan Escrow!'
          })
        });
      } catch (webhookErr) {
        console.log("Echèk nan tire webhook la, men tranzaksyon an pase.", webhookErr);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Bon travay! ${amountToRelease} HTG fèk ajoute sou balans ou.`,
      new_balance: newBalance
    });

  } catch (error) {
    return NextResponse.json({ error: 'Sèvè a rankontre yon pwoblèm.' }, { status: 500 });
  }
}