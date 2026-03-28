import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  // Nou kreye kliyan an anndan fonksyon an pou evite erè pandan "build"
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing environment variables" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date().toISOString();

    // 1. Jwenn tout abònman ki dwe lage (status: pending_escrow epi dat la rive)
    const { data: expiredSubs, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'pending_escrow')
      .lte('escrow_release_at', now);

    if (fetchError) throw fetchError;

    if (!expiredSubs || expiredSubs.length === 0) {
      return NextResponse.json({ message: "Pa gen kòb pou lage kounye a." });
    }

    for (const sub of expiredSubs) {
      // 2. Mete kòb la nan balans machann nan (RPC nou te kreye a)
      const { error: updateBalanceError } = await supabase.rpc('increment_wallet', {
        user_id_val: sub.merchant_id,
        amount_val: sub.amount
      });

      if (!updateBalanceError) {
        // 3. Chanje status abònman an pou l vin 'completed'
        await supabase
          .from('subscriptions')
          .update({ status: 'completed' })
          .eq('id', sub.id);
        
        // 4. Kreye yon tras nan tranzaksyon yo
        await supabase
          .from('transactions')
          .insert({
            user_id: sub.merchant_id,
            type: 'ESCROW_RELEASE',
            amount: sub.amount,
            description: `Kòb abònman #${sub.id.slice(0, 8)} lage otomatikman`,
            status: 'success'
          });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${expiredSubs.length} peman lage bay machann yo.` 
    });

  } catch (err: any) {
    console.error("Cron Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Sa a anpeche Next.js kache (cache) paj sa a
export const dynamic = 'force-dynamic';