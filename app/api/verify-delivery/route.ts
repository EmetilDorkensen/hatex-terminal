import { NextResponse } from 'next/server';
import { checkBalanceCap } from '@/lib/security/spending-limits';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { authenticateMerchantApiKey } from '@/lib/security/api-key';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = await rateLimit(`verify-delivery:${ip}`, 30, 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Twòp demann. Eseye ankò.' }, { status: 429 });
    }

    // 🔐 OTANTIFIKASYON OBLIGATWA: `merchant_id` PA JANM dwe soti nan kò
    // rekèt la (sa te louvri yon twou IDOR kote nenpòt moun ki devine yon
    // merchant_id + order_id + OTP te ka libere kòb yon lòt machann).
    // Sipòte 2 fason pou idantifye machann nan an sekirite:
    //   1. Bearer <api_key> — pou entegrasyon ekstèn (sèvè machann nan)
    //   2. Sesyon Supabase (cookie) — pou dashboard HatexCard entèn lan
    const supabaseAdmin = createSupabaseAdminClient();
    let merchant_id: string | null = null;

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const apiKey = authHeader.split(' ')[1].trim();
      const keyMatch = await authenticateMerchantApiKey(supabaseAdmin, apiKey);
      if (keyMatch?.is_merchant) merchant_id = keyMatch.id;
    }

    if (!merchant_id) {
      const supabaseSession = await createSupabaseServerClient();
      const { data: { user } } = await supabaseSession.auth.getUser();
      if (user) merchant_id = user.id;
    }

    if (!merchant_id) {
      return NextResponse.json({ error: 'Aksè refize. Konekte sou kont ou oswa itilize yon kle API valab.' }, { status: 401 });
    }

    const body = await req.json();
    const { transaction_id, otp_code, developer_webhook_url } = body;

    // 1. Tcheke si done yo antre
    if (!transaction_id || !otp_code) {
      return NextResponse.json({ error: 'Manke ID kòmand oswa Kòd OTP.' }, { status: 400 });
    }

    // Netwaye ID a pou asire l klè (Egzanp: "74" oswa "DEV-001")
    const cleanId = transaction_id.toString().replace('#', '').trim();

    // 2. VERIFIKASYON MACHANN NAN (idantifye pa kle API/sesyon, pa pa kò rekèt la)
    const { data: merchant, error: mErr } = await supabaseAdmin
      .from('profiles')
      .select('id, wallet_balance, account_status, failed_otp_attempts, account_type')
      .eq('id', merchant_id)
      .single();

    if (mErr || !merchant) return NextResponse.json({ error: 'Machann pa rekonèt nan sistèm nan.' }, { status: 404 });
    if (merchant.account_status === 'suspended') return NextResponse.json({ error: 'Kont ou bloke pou fwod. Kontakte sipò.' }, { status: 403 });

    const currentFailures = merchant.failed_otp_attempts || 0;

    // 🚨 3. VERIFIKASYON BAZ DONE A: Èske ID a egziste e li PENDING pou MACHANN sa a?
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('plugin_transactions')
      .select('*')
      .eq('order_id', cleanId)
      .eq('merchant_id', merchant_id)
      .eq('status', 'pending') // OBLIGATWA! Kòb la dwe bloke pou l ka debloke l
      .maybeSingle();

    // 4. PENALITE: Si ID a pa egziste, si l pa pou li, OUBYEN si kòd la pa bon
    if (txErr || !tx || otp_code.trim() !== String(tx.customer_info?.delivery_otp_code)) {
        const newFailures = currentFailures + 1;
        
        // Sispann otomatik apre 3 fwa
        if (newFailures >= 3) {
            await supabaseAdmin.from('profiles').update({ account_status: 'suspended', failed_otp_attempts: newFailures }).eq('id', merchant_id);
            return NextResponse.json({ error: 'Ou antre fo done 3 fwa. Kont ou sispann otomatikman.' }, { status: 403 });
        }
        
        await supabaseAdmin.from('profiles').update({ failed_otp_attempts: newFailures }).eq('id', merchant_id);
        
        const msgError = (!tx) ? `Ou pa gen okenn livrezon ki nan "Escrow" avèk ID #${cleanId} la.` : "Kòd OTP a pa bon!";
        return NextResponse.json({ error: `${msgError} Ou rete ${3 - newFailures} chans.` }, { status: 400 });
    }

    // ========================================================================
    // ✅ 5. TOUT BAGAY BON: DEBLOKE KÒB LA SOT NAN BANK GLOBAL LA
    // ========================================================================
    const amountToRelease = Number(tx.amount_htg);

    const capCheck = checkBalanceCap(Number(merchant.wallet_balance || 0), merchant.account_type, amountToRelease);
    if (!capCheck.allowed) {
      return NextResponse.json({ error: capCheck.message || 'Balans ou ta depase limit maksimòm otorize a.' }, { status: 400 });
    }

    const newBalance = Number(merchant.wallet_balance || 0) + amountToRelease;

    // Mete kòb la sou kont machann nan epi reset chans OTP yo
    await supabaseAdmin.from('profiles').update({ 
      wallet_balance: newBalance,
      failed_otp_attempts: 0 
    }).eq('id', merchant_id);

    // Chanje estati a fè l vin "delivered" pou l pa ka rale kòb sa yon dezyèm fwa
    await supabaseAdmin.from('plugin_transactions').update({ 
      status: 'delivered' 
    }).eq('id', tx.id);

    // 🚨 6. TIRE WEBHOOK LA (SI SE YON API CUSTOM) 🚨
    if (developer_webhook_url) {
      try {
        await fetch(developer_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'payment.unlocked',
            order_id: cleanId,
            amount_released: amountToRelease,
            status: 'success'
          })
        });
      } catch (webhookErr) {
        console.log("Echèk webhook, men kòb la debloke kòrèkteman.");
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Siksè! ${amountToRelease} HTG fèk debloke epi l ajoute sou balans ou.`,
      new_balance: newBalance
    });

  } catch (error: any) {
    console.error("Erè Verify Delivery:", error);
    return NextResponse.json({ error: 'Sèvè a gen yon pwoblèm teknik.' }, { status: 500 });
  }
}