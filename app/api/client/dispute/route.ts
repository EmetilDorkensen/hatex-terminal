import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { fileMerchantDispute } from '@/lib/gateway/disputes';

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
    const { order_id, reason, proof_text } = body;

    const result = await fileMerchantDispute(supabaseAdmin, { id: user.id, email: user.email }, {
      orderId: typeof order_id === 'string' ? order_id : String(order_id || ''),
      reason: typeof reason === 'string' ? reason : '',
      proofText: typeof proof_text === 'string' ? proof_text : null,
    });

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
  } catch (error: any) {
    console.error('Erè Dispute API:', error);
    return NextResponse.json({ error: 'Sèvè a gen yon pwoblèm teknik.' }, { status: 500 });
  }
}
