import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  buildPinFailureUpdate,
  hasAnyPin,
  isPinLocked,
  verifyAnyPin,
} from '@/lib/security/pin-lockout';

/** Estati friz kat. */
export async function GET() {
  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('is_card_frozen, is_card_activated, pin_code_hash, transaction_pin_hash')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    is_card_frozen: profile?.is_card_frozen === true,
    is_card_activated: profile?.is_card_activated === true,
    has_pin: hasAnyPin(profile || {}),
  });
}

/**
 * Friz oubyen defriz kat — PIN obligatwa.
 * Estati a chanje sèlman nan RPC set_card_frozen (baz).
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`card-freeze:${ip}`, 15, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const frozen = body?.frozen === true || body?.frozen === false ? body.frozen : null;
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';

  if (frozen === null) {
    return NextResponse.json({ error: 'Paramèt frozen manke (true/false).' }, { status: 400 });
  }
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN dwe gen 4 chif.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select(
      'id, pin_code_hash, transaction_pin_hash, failed_pin_attempts, pin_locked_until, account_status, pin_enabled, is_card_activated, is_card_frozen'
    )
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Pwofil pa jwenn.' }, { status: 404 });
  }

  const lock = isPinLocked(profile);
  if (lock.locked) {
    return NextResponse.json({ error: lock.message }, { status: 403 });
  }

  if (!hasAnyPin(profile)) {
    return NextResponse.json(
      {
        error: 'Ou dwe kreye yon PIN nan Paramèt anvan ou ka friz/defriz kat la.',
        needs_pin_setup: true,
      },
      { status: 400 }
    );
  }

  const { ok } = await verifyAnyPin(profile, pin);
  if (!ok) {
    const fail = await buildPinFailureUpdate(Number(profile.failed_pin_attempts || 0));
    await admin.from('profiles').update(fail.update).eq('id', user.id);
    return NextResponse.json({ error: fail.message }, { status: 403 });
  }

  // Reset failed attempts on success
  await admin
    .from('profiles')
    .update({ failed_pin_attempts: 0, pin_locked_until: null })
    .eq('id', user.id);

  const { data: rpcRaw, error: rpcErr } = await admin.rpc('set_card_frozen', {
    p_frozen: frozen,
    p_user_id: user.id,
  });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message || 'Pa t kapab chanje estati kat.' }, { status: 500 });
  }

  const result = typeof rpcRaw === 'string' ? JSON.parse(rpcRaw) : rpcRaw;
  if (!result?.success) {
    return NextResponse.json({ error: result?.message || 'Operasyon echwe.' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    is_card_frozen: result.is_card_frozen === true,
    already: !!result.already,
    message: result.message,
  });
}
