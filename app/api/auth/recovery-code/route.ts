import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { requireMfaTotpCode } from '@/lib/security/require-mfa-code';
import {
  generateRecoveryCode,
  hashRecoveryCode,
  encryptRecoveryCode,
  decryptRecoveryCode,
  recoveryCodeExpiry,
  isRecoveryCodeExpired,
} from '@/lib/security/recovery-code';

export const dynamic = 'force-dynamic';

/**
 * Kòd aksè inik (rekiperasyon).
 *
 * GET  — estati (èske li egziste, dat ekspirasyon) — pa retounen kòd la.
 * POST — { action: 'generate' | 'reveal', mfa_code }
 *        Step-up MFA obligatwa anvan nou jenere oswa afiche kòd la.
 */

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false as const };
  return { ok: true as const, supabase, user };
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`recovery-code-get:${ip}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp demann.' }, { status: 429 });
  }

  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  const db = createSupabaseAdminClient();
  const { data: profile } = await db
    .from('profiles')
    .select('recovery_code_hash, recovery_code_created_at, recovery_code_expires_at, recovery_code_used_at')
    .eq('id', auth.user.id)
    .maybeSingle();

  const exists = !!profile?.recovery_code_hash;
  return NextResponse.json({
    success: true,
    exists,
    expired: exists ? isRecoveryCodeExpired(profile?.recovery_code_expires_at) : false,
    created_at: profile?.recovery_code_created_at || null,
    expires_at: profile?.recovery_code_expires_at || null,
    used_at: profile?.recovery_code_used_at || null,
  });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`recovery-code-post:${ip}`, 10, 300);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action === 'reveal' ? 'reveal' : body.action === 'generate' ? 'generate' : '';
  if (!action) {
    return NextResponse.json({ success: false, message: 'Aksyon pa valab.' }, { status: 400 });
  }

  // ── Step-up MFA: toujou mande yon kòd 6 chif fre anvan nou manyen kòd aksè a
  const mfa = await requireMfaTotpCode(auth.supabase, body.mfa_code);
  if (!mfa.ok) {
    return NextResponse.json(
      { success: false, code: mfa.code, message: mfa.error },
      { status: mfa.status }
    );
  }

  const db = createSupabaseAdminClient();

  if (action === 'generate') {
    const code = generateRecoveryCode();
    const now = new Date();
    const expires = recoveryCodeExpiry(now);

    const { error } = await db
      .from('profiles')
      .update({
        recovery_code_hash: hashRecoveryCode(code),
        recovery_code_enc: encryptRecoveryCode(code),
        recovery_code_created_at: now.toISOString(),
        recovery_code_expires_at: expires.toISOString(),
        recovery_code_used_at: null,
      })
      .eq('id', auth.user.id);

    if (error) {
      console.error('[recovery-code] generate:', error.message);
      return NextResponse.json(
        { success: false, message: 'Pa t kapab sove kòd la. Eseye ankò.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      code,
      expires_at: expires.toISOString(),
      message:
        'Men kòd aksè inik ou. Kopye l epi sere l yon kote ki an sekirite — w ap sèvi avè l pou konekte si w bliye kòd MFA, modpas oswa PIN ou.',
    });
  }

  // action === 'reveal'
  const { data: profile } = await db
    .from('profiles')
    .select('recovery_code_enc, recovery_code_expires_at')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (!profile?.recovery_code_enc) {
    return NextResponse.json(
      { success: false, code: 'no_code', message: 'Ou poko gen kòd aksè. Jenere youn.' },
      { status: 404 }
    );
  }

  if (isRecoveryCodeExpired(profile.recovery_code_expires_at)) {
    return NextResponse.json(
      { success: false, code: 'expired', message: 'Kòd aksè ou ekspire. Jenere yon nouvo.' },
      { status: 410 }
    );
  }

  const code = decryptRecoveryCode(profile.recovery_code_enc);
  if (!code) {
    return NextResponse.json(
      { success: false, code: 'decrypt_failed', message: 'Pa t kapab dechifre kòd la. Jenere yon nouvo.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    code,
    expires_at: profile.recovery_code_expires_at,
    message:
      'Kopye kòd la epi sere l yon kote ki an sekirite — w ap sèvi avè l pou konekte nan kont ou si w bliye kòd MFA ou.',
  });
}
