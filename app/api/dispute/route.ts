import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { fileMerchantDispute } from '@/lib/gateway/disputes';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = await rateLimit(`dispute:${ip}`, 15, 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Twòp demann. Eseye ankò.' }, { status: 429 });
    }

    // 🔐 OTANTIFIKASYON OBLIGATWA: `clientId` PA JANM soti nan kò rekèt la.
    const supabaseSession = await createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Ou dwe konekte sou kont ou pou ouvè yon litij.' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    const body = await req.json();
    const { orderId, reason, proofText, storeName } = body;
    const clientId = user.id;

    if (!orderId) {
      return NextResponse.json({ error: 'ID Kòmand lan obligatwa' }, { status: 400 });
    }

    const cleanId = String(orderId).trim().toLowerCase();

    // 1. Acha machann (plugin_transactions) — itilize lojik pataje a ki kouvri
    //    tou gateway v2 (hatex_payments) ak sispansyon otomatik apre 3 rapò.
    let { data: pluginTx } = await supabase
      .from('plugin_transactions')
      .select('order_id')
      .ilike('order_id', `${cleanId}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pluginTx) {
      const { data: pluginTxOld } = await supabase
        .from('plugin_transactions')
        .select('order_id')
        .ilike('id', `${cleanId}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      pluginTx = pluginTxOld;
    }

    if (pluginTx?.order_id) {
      const result = await fileMerchantDispute(
        supabase,
        { id: clientId, email: user.email },
        {
          orderId: pluginTx.order_id,
          reason: typeof reason === 'string' ? reason : String(reason || ''),
          proofText: typeof proofText === 'string' ? proofText : null,
          storeName: typeof storeName === 'string' ? storeName : null,
        }
      );
      if (!result.ok) {
        return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
      }
      return NextResponse.json({
        success: true,
        code: result.code,
        dispute_id: result.disputeId,
        merchant_suspended: result.merchantSuspended,
        message: result.message,
      });
    }

    // 2. Si l pa la, chèche nan transactions (P2P, depo, elatriye)
    let { data: normTx } = await supabase
      .from('transactions')
      .select('*')
      .ilike('order_id', `${cleanId}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!normTx) {
      const { data: normTxOld } = await supabase
        .from('transactions')
        .select('*')
        .ilike('id', `${cleanId}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      normTx = normTxOld;
    }

    if (!normTx) {
      return NextResponse.json(
        { error: 'Nou pa jwenn kòmand sa a nan sistèm nan. Tcheke ID a byen.' },
        { status: 404 }
      );
    }

    // 🔐 Posesyon: yon tranzaksyon transactions apatyen a moun ki fè l.
    if (normTx.user_id !== clientId) {
      return NextResponse.json(
        { error: 'Kòmand sa a pa asosye ak kont ou. Ou pa ka ouvè yon litij sou li.' },
        { status: 403 }
      );
    }

    const disputeDetails = {
      client_id: clientId,
      store_name: storeName || normTx.metadata?.merchant_name || 'Transfè / Acha',
      proof_text: proofText || reason || 'Kliyan an fè yon plent.',
      admin_reply: null,
    };

    await supabase
      .from('transactions')
      .update({
        status: 'disputed',
        description: `[LITIJ] ${normTx.description || 'Tranzaksyon'}`,
        metadata: { ...normTx.metadata, dispute_details: disputeDetails },
      })
      .eq('id', normTx.id);

    return NextResponse.json({
      success: true,
      message: 'Plent ou a ale avèk siksè! Admin an ap reponn ou.',
    });
  } catch (error: any) {
    console.error('Erè nan API Litij la:', error);
    return NextResponse.json({ error: 'Gen yon pwoblèm nan sistèm nan. Eseye ankò pita.' }, { status: 500 });
  }
}
