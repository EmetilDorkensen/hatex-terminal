import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
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

    // Chèche pa email (egzak oswa lower) — email ka gen majiskil nan DB
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(
        'id, email, pin_code, pin_code_hash, transaction_pin, transaction_pin_hash, pin_enabled, failed_pin_attempts, pin_locked_until, account_status'
      )
      .ilike('email', cleanEmail)
      .limit(5);

    if (error || !profiles?.length) {
      return NextResponse.json({ success: false, message: 'Email oswa PIN pa bon.' }, { status: 401 });
    }

    const profile =
      profiles.find((p) => String(p.email || '').trim().toLowerCase() === cleanEmail) || profiles[0];

    const lock = isPinLocked(profile);
    if (lock.locked) {
      return NextResponse.json({ success: false, message: lock.message }, { status: 403 });
    }

    if (!hasAnyPin(profile) && !profile.pin_enabled) {
      return NextResponse.json({ success: false, message: 'PIN pa aktive pou kont sa a.' }, { status: 400 });
    }

    const { ok: pinOk } = await verifyAnyPin(profile, String(pin));

    if (!pinOk) {
      const failure = await buildPinFailureUpdate(profile.failed_pin_attempts || 0);
      await supabase.from('profiles').update(failure.update).eq('id', profile.id);
      return NextResponse.json({ success: false, message: failure.message }, { status: 401 });
    }

    // Migre/sync: asire tou de kolòn PIN gen menm hash pou tout kont
    const needsSync =
      !profile.pin_code_hash ||
      !profile.transaction_pin_hash ||
      !!profile.pin_code ||
      !!profile.transaction_pin ||
      !profile.pin_enabled;

    if (needsSync) {
      await supabase
        .from('profiles')
        .update(await buildPinSuccessUpdate(String(pin)))
        .eq('id', profile.id);
    } else {
      await supabase
        .from('profiles')
        .update({ failed_pin_attempts: 0, pin_locked_until: null, pin_enabled: true })
        .eq('id', profile.id);
    }

    const sessionEmail = String(profile.email || cleanEmail).trim();

    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: sessionEmail,
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
      email: sessionEmail.toLowerCase(),
      token_hash: linkData.properties.hashed_token,
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
