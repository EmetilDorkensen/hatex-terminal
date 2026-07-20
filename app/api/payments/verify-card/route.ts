import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { findProfileByCard } from '@/lib/security/card-lookup';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { hashCardNumber } from '@/lib/security/hash';

// Lock-out PA KAT (menm modèl ak lock-out PIN/OTP ki egziste deja):
// san sa, yon atakè ka gaye tantativ li sou plizyè IP diferan pou kontounen
// limit ki baze sèlman sou IP epi "bwote" (brute-force) yon nimewo kat presi.
const MAX_CARD_ATTEMPTS = 6;
const CARD_LOCK_WINDOW_SEC = 15 * 60;

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

    // 🔐 LOCK-OUT PA KAT: endepandan de IP a, chak nimewo kat gen dwa a yon
    // kantite tantativ limite pandan 15 minit anvan li bloke tanporèman.
    const cardHash = hashCardNumber(cleanCard);
    const cardRl = await rateLimit(`card-verify:${cardHash}`, MAX_CARD_ATTEMPTS, CARD_LOCK_WINDOW_SEC);
    if (!cardRl.allowed) {
      const mins = Math.ceil((cardRl.retryAfterSec || CARD_LOCK_WINDOW_SEC) / 60);
      return NextResponse.json({ valid: false, error: `Twòp tantativ sou kat sa a. Eseye ankò nan ${mins} minit.` }, { status: 429 });
    }

    const supabase = createSupabaseAdminClient();
    const { profile, error } = await findProfileByCard(supabase, cleanCard, String(cvv), rawExp, slashedExp);

    if (!profile) {
      return NextResponse.json({ valid: false, error: error || 'Kat pa rekonèt.' }, { status: 401 });
    }

    const { data: fullProfile } = await supabase
      .from('profiles')
      .select('id, is_activated, account_status, is_card_frozen')
      .eq('id', profile.id)
      .single();

    if (!fullProfile) {
      return NextResponse.json({ valid: false, error: 'Kat pa rekonèt.' }, { status: 401 });
    }

    if (fullProfile.is_card_frozen === true) {
      return NextResponse.json(
        { valid: false, error: 'Kat sa a friz. Defriz li anvan ou ka peye.', card_frozen: true },
        { status: 403 }
      );
    }

    // ⚠️ Pa janm retounen PII (non, imèl, balans, UUID) bay yon moun ki jis gen
    // nimewo kat + CVV. Sa te yon "orak" ki te pèmèt enumerasyon/fwod. Peman
    // abònman an pase pa /api/subscribe/pay kounye a ki fè tout bagay sou sèvè.
    return NextResponse.json({
      valid: true,
      is_activated: fullProfile.is_activated,
      account_status: fullProfile.account_status,
    });
  } catch {
    return NextResponse.json({ valid: false, error: 'Erè sèvè.' }, { status: 500 });
  }
}
