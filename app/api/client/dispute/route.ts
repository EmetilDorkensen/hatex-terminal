import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    const body = await req.json();
    const { order_id, client_id, reason } = body;

    if (!order_id || !client_id || !reason) {
      return NextResponse.json({ error: 'Manke enfòmasyon pou ouvè litij la.' }, { status: 400 });
    }

    const cleanOrderId = order_id.toString().replace('#', '').trim();

    // 1. Chèche tranzaksyon an nan Bank Global la
    // Nou verifye si kòmand sa se pou kliyan sa a vre (li dwe nan customer_info a)
    // Pou kounye a, n ap jis chèche l ak order_id a pou n wè si l PENDING
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('plugin_transactions')
      .select('*')
      .eq('order_id', cleanOrderId)
      .single();

    if (txErr || !tx) {
      return NextResponse.json({ error: 'Nou pa jwenn kòmand sa a nan sistèm nan.' }, { status: 404 });
    }

    // 2. VERIFIKASYON ESTATI
    if (tx.status === 'delivered') {
      return NextResponse.json({ error: 'Twò ta! Ou te gentan bay kòd OTP a epi machann nan touche kòb la deja. Kontakte Admin.' }, { status: 403 });
    }
    
    if (tx.status === 'disputed') {
      return NextResponse.json({ error: 'Kòmand sa a gen yon litij sou li deja.' }, { status: 400 });
    }

    if (tx.status === 'refunded') {
      return NextResponse.json({ error: 'Lajan kòmand sa a te gentan ranbouse deja.' }, { status: 400 });
    }

    // 🚨 3. MAJI ALIEXPRESS LA: JELE KÒB LA (Freeze)
    // Nou chanje estati a fè l vin "disputed" epi nou anrejistre rezon an
    const { error: updateErr } = await supabaseAdmin
      .from('plugin_transactions')
      .update({ 
        status: 'disputed',
        dispute_reason: reason
      })
      .eq('id', tx.id);

    if (updateErr) throw updateErr;

    // TODO: (Opsyonèl) Voye yon Imèl bay Machann nan pou di l kliyan an plenyen
    // "Kliyan ou an mande yon ranbousman paske: [reason]"

    return NextResponse.json({ 
      success: true, 
      message: 'Plent lan anrejistre! Lajan an jele, machann nan pa ka touche l. Nap tann machann nan reponn.' 
    });

  } catch (error: any) {
    console.error("Erè Dispute API:", error);
    return NextResponse.json({ error: 'Sèvè a gen yon pwoblèm teknik.' }, { status: 500 });
  }
}