import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import {
  isPinLocked,
  verifyWalletPin,
  buildPinFailureUpdate,
  buildPinMigrationUpdate,
} from '@/lib/security/pin-lockout';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`pin-login:${ip}`, 10, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  try {
    const { email, pin } = await request.json();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || String(pin || '').length !== 4) {
      return NextResponse.json({ success: false, message: 'Email oswa PIN pa valab.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, pin_code, pin_code_hash, pin_enabled, failed_pin_attempts, pin_locked_until, account_status')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error || !profile) {
      return NextResponse.json({ success: false, message: 'Email oswa PIN pa bon.' }, { status: 401 });
    }

    const lock = isPinLocked(profile);
    if (lock.locked) {
      return NextResponse.json({ success: false, message: lock.message }, { status: 403 });
    }

    if (!profile.pin_enabled && !profile.pin_code && !profile.pin_code_hash) {
      return NextResponse.json({ success: false, message: 'PIN pa aktive pou kont sa a.' }, { status: 400 });
    }

    const pinOk = await verifyWalletPin(profile, String(pin));

    if (!pinOk) {
      const failure = await buildPinFailureUpdate(profile.failed_pin_attempts || 0);
      await supabase.from('profiles').update(failure.update).eq('id', profile.id);
      return NextResponse.json({ success: false, message: failure.message }, { status: 401 });
    }

    if (profile.pin_code && !profile.pin_code_hash) {
      const migration = await buildPinMigrationUpdate(profile, String(pin), 'wallet');
      await supabase.from('profiles').update(migration).eq('id', profile.id);
    }

    await supabase
      .from('profiles')
      .update({ failed_pin_attempts: 0, pin_locked_until: null })
      .eq('id', profile.id);

    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: cleanEmail,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error('PIN generateLink failed:', linkErr?.message);
      return NextResponse.json(
        {
          success: false,
          message:
            'Pa kapab kreye sesyon PIN. Verifye SUPABASE_SERVICE_ROLE_KEY sou Vercel, oswa konekte ak modpas.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'PIN verifye.',
      email: cleanEmail,
      token_hash: linkData.properties.hashed_token,
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
