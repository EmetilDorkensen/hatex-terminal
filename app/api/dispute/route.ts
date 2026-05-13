import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Nou kreye koneksyon ak baz done a
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Front-end lan voye ID a ak rezon an, nou pran yo:
    const { orderId, reason, proofText, clientId, storeName } = body;

    if (!orderId) {
      return NextResponse.json({ error: "ID Kòmand lan obligatwa" }, { status: 400 });
    }

    const cleanId = orderId.trim().toLowerCase();

    // 1. Nou chèche kòmand lan nan baz done a ak nouvo order_id la (12 chif)
    let { data: tx, error: fetchError } = await supabase
      .from('plugin_transactions')
      .select('*')
      .ilike('order_id', `${cleanId}%`)
      .maybeSingle();

    // Si l pa jwenn li nan order_id la, l ap eseye chèche ansyen fòma ID yo
    if (!tx) {
        const { data: txOld } = await supabase
        .from('plugin_transactions')
        .select('*')
        .ilike('id', `${cleanId}%`)
        .maybeSingle();
        tx = txOld;
    }

    // Si l toujou pa jwenn li ditou, nou voye erè 404 la bay kliyan an
    if (!tx) {
        return NextResponse.json({ error: "Nou pa jwenn kòmand sa a nan sistèm nan. Tcheke ID a byen." }, { status: 404 });
    }

    // 2. Si l jwenn kòmand lan, nou prepare detay litij yo pou Admin an ka wè yo
    const disputeDetails = {
        client_id: clientId || tx.user_id,
        store_name: storeName || tx.metadata?.merchant_name || 'Boutik',
        proof_text: proofText || reason || 'Kliyan an fè yon plent.',
        admin_reply: null
    };

    // 3. Nou mete estati kòmand lan sou "disputed" (LITIJ)
    const { error: updateError } = await supabase
        .from('plugin_transactions')
        .update({ 
            status: 'disputed',
            dispute_reason: reason || 'Plent Kliyan',
            dispute_details: disputeDetails
        })
        .eq('id', tx.id);

    if (updateError) {
        throw updateError;
    }

    // 4. Tout bagay pase byen!
    return NextResponse.json({ success: true, message: "Plent ou a ale avèk siksè! Admin an ap reponn ou." }, { status: 200 });

  } catch (error: any) {
    console.error("Erè nan API Litij la:", error);
    return NextResponse.json({ error: "Gen yon pwoblèm nan sistèm nan. Eseye ankò pita." }, { status: 500 });
  }
}