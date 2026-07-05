import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = await rateLimit(`client-dispute:${ip}`, 15, 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Twòp demann. Eseye ankò.' }, { status: 429 });
    }

    // 🔐 OTANTIFIKASYON OBLIGATWA: `client_id` PA JANM soti nan kò rekèt la.
    const supabaseSession = await createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Ou dwe konekte sou kont ou pou ouvè yon litij.' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    const body = await req.json();
    const { order_id, reason } = body;

    if (!order_id || !reason) {
      return NextResponse.json({ error: 'Manke enfòmasyon pou ouvè litij la.' }, { status: 400 });
    }

    const cleanOrderId = order_id.toString().replace('#', '').trim();

    // 1. Chèche tranzaksyon an nan Bank Global la
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('plugin_transactions')
      .select('*')
      .eq('order_id', cleanOrderId)
      .single();

    if (txErr || !tx) {
      return NextResponse.json({ error: 'Nou pa jwenn kòmand sa a nan sistèm nan.' }, { status: 404 });
    }

    // 🔐 2. VERIFIKASYON POSESYON: kòmand la dwe reyèlman apatyen a moun ki
    // konekte a (matche pa imèl nan customer_info), sinon nenpòt itilizatè
    // konekte ta ka jele kòb sou kòmand yon lòt moun.
    if ((tx.customer_info?.email || '').toLowerCase() !== (user.email || '').toLowerCase()) {
      return NextResponse.json({ error: 'Kòmand sa a pa asosye ak kont ou. Ou pa ka ouvè yon litij sou li.' }, { status: 403 });
    }

    // 3. VERIFIKASYON ESTATI
    if (tx.status === 'delivered') {
      return NextResponse.json({ error: 'Twò ta! Ou te gentan bay kòd OTP a epi machann nan touche kòb la deja. Kontakte Admin.' }, { status: 403 });
    }
    
    if (tx.status === 'disputed') {
      return NextResponse.json({ error: 'Kòmand sa a gen yon litij sou li deja.' }, { status: 400 });
    }

    if (tx.status === 'refunded') {
      return NextResponse.json({ error: 'Lajan kòmand sa a te gentan ranbouse deja.' }, { status: 400 });
    }

    // 🚨 4. MAJI ALIEXPRESS LA: JELE KÒB LA (Freeze)
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