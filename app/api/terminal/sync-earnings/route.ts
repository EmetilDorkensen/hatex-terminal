import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

/** Senkronize revni terminal → wallet machann (sèlman sou sèvè). */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`terminal-sync:${ip}`, 10, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp demann. Eseye pita.' }, { status: 429 });
  }

  try {
    const supabaseSession = await createSupabaseServerClient();
    const { data: { user } } = await supabaseSession.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const amount = Math.floor(Number(body.amount_to_add));
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Montan pa valab.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, is_merchant, account_status')
      .eq('id', user.id)
      .single();

    if (!profile?.is_merchant) {
      return NextResponse.json({ success: false, message: 'Sèlman machann ka senkronize revni.' }, { status: 403 });
    }
    if (profile.account_status === 'suspended') {
      return NextResponse.json({ success: false, message: 'Kont ou a sispandi.' }, { status: 403 });
    }

    const { error } = await supabase.rpc('increment_merchant_balance', {
      merchant_id: user.id,
      amount_to_add: amount,
    });

    if (error) {
      return NextResponse.json({ success: false, message: 'Senkronizasyon an pa t reyisi.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Balans Wallet ou moute avèk siksè!' });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
