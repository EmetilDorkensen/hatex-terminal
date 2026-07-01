import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { findProfileByCard } from '@/lib/security/card-lookup';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`verify-card:${ip}`, 20, 300);
  if (!rl.allowed) {
    return NextResponse.json({ valid: false, error: 'Twòp tantativ.' }, { status: 429 });
  }

  try {
    const { cardNumber, cvv, expiry } = await request.json();
    const cleanCard = String(cardNumber || '').replace(/\D/g, '');
    const rawExp = String(expiry || '').replace(/\D/g, '');
    const slashedExp = rawExp.length === 4 ? `${rawExp.slice(0, 2)}/${rawExp.slice(2)}` : String(expiry);

    if (cleanCard.length !== 16 || String(cvv).length < 3) {
      return NextResponse.json({ valid: false, error: 'Kat pa valab.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { profile, error } = await findProfileByCard(supabase, cleanCard, String(cvv), rawExp, slashedExp);

    if (!profile) {
      return NextResponse.json({ valid: false, error: error || 'Kat pa rekonèt.' }, { status: 401 });
    }

    const { data: fullProfile } = await supabase
      .from('profiles')
      .select('id, card_balance, is_activated, full_name, email, account_status')
      .eq('id', profile.id)
      .single();

    if (!fullProfile) {
      return NextResponse.json({ valid: false, error: 'Kat pa rekonèt.' }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      clientId: fullProfile.id,
      card_balance: fullProfile.card_balance,
      is_activated: fullProfile.is_activated,
      full_name: fullProfile.full_name,
      email: fullProfile.email,
      account_status: fullProfile.account_status,
    });
  } catch {
    return NextResponse.json({ valid: false, error: 'Erè sèvè.' }, { status: 500 });
  }
}
