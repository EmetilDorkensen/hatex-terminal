import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, reason, proofText, clientId, storeName } = body;

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