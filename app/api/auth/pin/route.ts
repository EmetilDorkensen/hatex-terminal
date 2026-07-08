import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import {
  isPinLocked,
  verifyAnyPin,
  hasAnyPin,
  buildPinFailureUpdate,
  buildPinSuccessUpdate,
} from '@/lib/security/pin-lockout';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`pin-api:${ip}`, 30, 300);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { action, pin, oldPin } = body;

    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(
        'id, pin_code, pin_code_hash, transaction_pin, transaction_pin_hash, failed_pin_attempts, pin_locked_until, account_status, pin_enabled'
      )
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ success: false, message: 'Pwofil pa jwenn.' }, { status: 404 });
    }

    const lock = isPinLocked(profile);
    if (lock.locked && action !== 'status') {
      return NextResponse.json({ success: false, message: lock.message }, { status: 403 });
    }

    if (action === 'status') {
      const hasPin = hasAnyPin(profile);
      return NextResponse.json({
        success: true,
        hasTransactionPin: hasPin,
        hasWalletPin: hasPin,
        hasPin,
      });
    }

    if (action === 'set') {
      if (String(pin || '').length !== 4) {
        return NextResponse.json({ success: false, message: 'PIN dwe gen 4 chif.' }, { status: 400 });
      }

      const updates = await buildPinSuccessUpdate(String(pin));
      await supabase.from('profiles').update(updates).eq('id', user.id);

      return NextResponse.json({ success: true, message: 'PIN anrejistre avèk siksè.' });
    }

    if (action === 'update') {
      if (String(oldPin || '').length !== 4 || String(pin || '').length !== 4) {
        return NextResponse.json({ success: false, message: 'PIN dwe gen 4 chif.' }, { status: 400 });
      }

      const { ok: oldOk } = await verifyAnyPin(profile, String(oldPin));
      if (!oldOk) {
        const failure = await buildPinFailureUpdate(profile.failed_pin_attempts || 0);
        await supabase.from('profiles').update(failure.update).eq('id', user.id);
        return NextResponse.json({ success: false, message: failure.message }, { status: 401 });
      }

      const updates = await buildPinSuccessUpdate(String(pin));
      await supabase.from('profiles').update(updates).eq('id', user.id);
      return NextResponse.json({ success: true, message: 'PIN chanje avèk siksè.' });
    }

    if (action === 'verify') {
      if (String(pin || '').length !== 4) {
        return NextResponse.json({ success: false, message: 'PIN dwe gen 4 chif.' }, { status: 400 });
      }

      const { ok: pinOk } = await verifyAnyPin(profile, String(pin));

      if (!pinOk) {
        const failure = await buildPinFailureUpdate(profile.failed_pin_attempts || 0);
        await supabase.from('profiles').update(failure.update).eq('id', user.id);
        return NextResponse.json({ success: false, message: failure.message }, { status: 401 });
      }

      // Sync de PIN yo apre verifikasyon siksè
      if (
        !profile.pin_code_hash ||
        !profile.transaction_pin_hash ||
        profile.pin_code ||
        profile.transaction_pin ||
        !profile.pin_enabled
      ) {
        await supabase.from('profiles').update(await buildPinSuccessUpdate(String(pin))).eq('id', user.id);
      } else {
        await supabase
          .from('profiles')
          .update({ failed_pin_attempts: 0, pin_locked_until: null })
          .eq('id', user.id);
      }

      return NextResponse.json({ success: true, message: 'PIN verifye.' });
    }

    return NextResponse.json({ success: false, message: 'Aksyon pa valab.' }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
