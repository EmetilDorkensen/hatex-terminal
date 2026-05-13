import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    const body = await req.json();
    const { order_id, client_id, store_name, reason, proof_text, date } = body;

    // Verifye si tout prèv yo la
    if (!order_id || !store_name || !proof_text) {
      return NextResponse.json({ error: 'Ou dwe ranpli tout enfòmasyon yo avèk prèv ou yo.' }, { status: 400 });
    }

    const cleanOrderId = order_id.toString().replace('#', '').trim();

    // 1. Chèche tranzaksyon an nan Bank Global la
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('plugin_transactions')
      .select('*')
      .eq('order_id', cleanOrderId)
      .single();

    if (txErr || !tx) {
      return NextResponse.json({ error: 'Nou pa jwenn kòmand sa a nan sistèm nan. Tcheke ID a byen.' }, { status: 404 });
    }

    // 2. Tcheke estati kòmand lan
    if (tx.status === 'delivered') return NextResponse.json({ error: 'Twò ta! Ou te gentan bay machann nan kòd OTP a. Lajan an soti nan Bank Global la deja.' }, { status: 403 });
    if (tx.status === 'disputed') return NextResponse.json({ error: 'Kòmand sa a gen yon litij sou li deja.' }, { status: 400 });
    if (tx.status === 'refunded') return NextResponse.json({ error: 'Kòmand sa a ranbouse deja.' }, { status: 400 });

    // 3. Pake tout prèv yo nan yon sèl dosye
    const disputeDetails = {
      client_id,
      store_name,
      reason,
      proof_text,
      date_filed: date
    };

    // 🚨 4. MAJI A: NOU JELE KÒB LA EPI NOU VOYE L BAY ADMIN AN 🚨
    const { error: updateErr } = await supabaseAdmin
      .from('plugin_transactions')
      .update({ 
        status: 'disputed', // Fè machann nan pa ka touche l
        dispute_reason: reason,
        dispute_details: disputeDetails // Anrejistre prèv yo pou Admin an ka li l
      })
      .eq('id', tx.id);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, message: 'Admin an resevwa prèv ou yo. Kòb la jele.' });

  } catch (error: any) {
    console.error("Erè API Litij:", error);
    return NextResponse.json({ error: 'Sèvè a gen yon pwoblèm teknik.' }, { status: 500 });
  }
}