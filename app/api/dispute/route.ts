import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = await rateLimit(`dispute:${ip}`, 15, 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Twòp demann. Eseye ankò.' }, { status: 429 });
    }

    // 🔐 OTANTIFIKASYON OBLIGATWA: `clientId` PA JANM soti nan kò rekèt la
    // (sa te pèmèt nenpòt moun ouvri yon litij sou yon kòmand ki pa pou li).
    // Idantite kliyan an soti SÈLMAN nan sesyon Supabase otantifye a.
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
      return NextResponse.json({ error: "ID Kòmand lan obligatwa" }, { status: 400 });
    }

    const cleanId = orderId.trim().toLowerCase();
    let tx = null;
    let tableName = 'plugin_transactions';

    // 1. Nou chèche nan plugin_transactions an premye (Acha WooCommerce/API)
    let { data: pluginTx } = await supabase.from('plugin_transactions').select('*').ilike('order_id', `${cleanId}%`).maybeSingle();
    if (!pluginTx) {
        const { data: pluginTxOld } = await supabase.from('plugin_transactions').select('*').ilike('id', `${cleanId}%`).maybeSingle();
        pluginTx = pluginTxOld;
    }

    if (pluginTx) {
        tx = pluginTx;
    } else {
        // 2. Si l pa la, nou chèche nan transactions (Transfè P2P, Depo, elatriye)
        let { data: normTx } = await supabase.from('transactions').select('*').ilike('order_id', `${cleanId}%`).maybeSingle();
        if (!normTx) {
            const { data: normTxOld } = await supabase.from('transactions').select('*').ilike('id', `${cleanId}%`).maybeSingle();
            normTx = normTxOld;
        }
        if (normTx) {
            tx = normTx;
            tableName = 'transactions';
        }
    }

    // 3. Si l toujou pa jwenn li, se lè sa a nou voye erè a
    if (!tx) {
        return NextResponse.json({ error: "Nou pa jwenn kòmand sa a nan sistèm nan. Tcheke ID a byen." }, { status: 404 });
    }

    // 🔐 4. VERIFIKASYON POSESYON: sesyon an dwe apatyen a MENM moun ki lye ak
    // tranzaksyon an — sinon nenpòt itilizatè konekte ta ka jele kòb yon lòt
    // moun jis paske li konn/devine yon ID kòmand.
    const isOwner = tableName === 'transactions'
        ? tx.user_id === clientId
        : (tx.customer_info?.email || '').toLowerCase() === (user.email || '').toLowerCase();

    if (!isOwner) {
        return NextResponse.json({ error: "Kòmand sa a pa asosye ak kont ou. Ou pa ka ouvè yon litij sou li." }, { status: 403 });
    }

    // Prepare detay yo kèlkeswa estati l te ye (sikse, konfime, vs)
    const disputeDetails = {
        client_id: clientId || tx.user_id,
        store_name: storeName || tx.metadata?.merchant_name || 'Transfè / Acha',
        proof_text: proofText || reason || 'Kliyan an fè yon plent.',
        admin_reply: null
    };

    // Mete l an 'disputed'
    if (tableName === 'plugin_transactions') {
         await supabase.from('plugin_transactions').update({ 
            status: 'disputed', 
            dispute_reason: reason || 'Plent Kliyan', 
            dispute_details: disputeDetails 
        }).eq('id', tx.id);
    } else {
         await supabase.from('transactions').update({ 
            status: 'disputed', 
            description: `[LITIJ] ${tx.description || 'Tranzaksyon'}`, 
            metadata: { ...tx.metadata, dispute_details: disputeDetails } 
        }).eq('id', tx.id);
    }

    return NextResponse.json({ success: true, message: "Plent ou a ale avèk siksè! Admin an ap reponn ou." }, { status: 200 });

  } catch (error: any) {
    console.error("Erè nan API Litij la:", error);
    return NextResponse.json({ error: "Gen yon pwoblèm nan sistèm nan. Eseye ankò pita." }, { status: 500 });
  }
}