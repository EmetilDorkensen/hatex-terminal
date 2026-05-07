import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    const body = await req.json();
    const { transaction_id, merchant_id, otp_code } = body;

    // 1. Sekirite baz: tcheke si tout enfòmasyon yo la
    if (!transaction_id || !merchant_id || !otp_code) {
      return NextResponse.json({ error: 'Manke enfòmasyon pou verifikasyon an.' }, { status: 400 });
    }

    const cleanId = transaction_id.toString().replace('#', '').trim();

    // 2. Tcheke si machann nan egziste epi si l pa bloke
    const { data: merchant, error: mErr } = await supabaseAdmin
      .from('profiles')
      .select('id, account_status, wallet_balance, failed_otp_attempts')
      .eq('id', merchant_id)
      .single();

    if (mErr || !merchant) return NextResponse.json({ error: 'Machann pa rekonèt nan sistèm nan.' }, { status: 404 });
    if (merchant.account_status === 'suspended') {
      return NextResponse.json({ error: 'Kont ou bloke pou sispèk frod. Kontakte sipò.' }, { status: 403 });
    }

    // 3. CHÈCHE TRANZAKSYON AN (Entelijan: l ap gade nan ID oswa nan ORDER_ID)
    // Sa pèmèt li mache pou API (Custom) ak PLUGIN (WooCommerce) an menm tan.
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('plugin_transactions')
      .select('*')
      .or(`id.eq.${cleanId},order_id.eq.${cleanId}`) 
      .eq('merchant_id', merchant_id)
      .maybeSingle();

    if (txErr || !tx) {
      return NextResponse.json({ error: `Nou pa jwenn okenn tranzaksyon ki gen ID [${cleanId}] la.` }, { status: 404 });
    }

    if (tx.status === 'delivered') {
      return NextResponse.json({ error: 'Lajan sa a te debloke deja.' }, { status: 400 });
    }

    // 4. VERIFYE KÒD 4 CHIF LA (OTP)
    const storedOtp = tx.customer_info?.delivery_otp;
    const currentFailures = merchant.failed_otp_attempts || 0;

    if (otp_code.trim() !== String(storedOtp)) {
      const newFailures = currentFailures + 1;
      
      // Sistèm 3-strikes: nan 3zyèm fwa a, nou bloke machann nan
      if (newFailures >= 3) {
        await supabaseAdmin.from('profiles').update({ account_status: 'suspended', failed_otp_attempts: newFailures }).eq('id', merchant_id);
        return NextResponse.json({ error: 'Ou rate 3 fwa. Kont ou sispann otomatikman.' }, { status: 403 });
      }

      await supabaseAdmin.from('profiles').update({ failed_otp_attempts: newFailures }).eq('id', merchant_id);
      return NextResponse.json({ error: `Kòd la pa bon. Ou rete ${3 - newFailures} chans.` }, { status: 400 });
    }

    // ============================================================
    // ✅ SI TOUT BAGAY BON: NOU LAGE KÒB LA SOU BALANS LI
    // ============================================================
    const amountToRelease = Number(tx.amount_htg);
    const newBalance = Number(merchant.wallet_balance || 0) + amountToRelease;

    // A. Mete kòb la sou balans machann nan epi reset echèk yo
    await supabaseAdmin.from('profiles').update({ 
      wallet_balance: newBalance,
      failed_otp_attempts: 0 
    }).eq('id', merchant_id);

    // B. Chanje estati tranzaksyon an nan "delivered" pou l pa ka itilize ankò
    await supabaseAdmin.from('plugin_transactions').update({ 
      status: 'delivered' 
    }).eq('id', tx.id);

    return NextResponse.json({ 
      success: true, 
      message: `Bravo! ${amountToRelease} HTG ajoute sou balans ou.`,
      new_balance: newBalance
    });

  } catch (error) {
    console.error("Critical Error Verify Delivery:", error);
    return NextResponse.json({ error: 'Sèvè a gen yon pwoblèm teknik.' }, { status: 500 });
  }
}