import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { hashRecoveryToken } from '@/lib/security/recovery-code';

export const dynamic = 'force-dynamic';

/**
 * Itilize lyen rekiperasyon an (soti nan email — valab 1 èdtan, yon sèl fwa).
 *
 * 1. Verifye token an (HMAC hash nan baz done a) + ekspirasyon + poko itilize
 * 2. Efase tout faktè MFA yo (kliyan an pral re-anrejistre yon nouvo)
 * 3. Make demann lan "completed" + token boule
 * 4. Retounen token_hash magiclink → kliyan an verifyOtp → /mfa-setup
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`recovery-redeem:${ip}`, 10, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (token.length < 32) {
    return NextResponse.json({ success: false, message: 'Lyen pa valab.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const tokenHash = hashRecoveryToken(token);

  const { data: req } = await db
    .from('account_recovery_requests')
    .select('id, user_id, email, status, reset_token_expires_at, reset_token_used_at')
    .eq('reset_token_hash', tokenHash)
    .maybeSingle();

  if (!req) {
    return NextResponse.json(
      { success: false, code: 'invalid', message: 'Lyen an pa valab. Kontakte asistans lan.' },
      { status: 401 }
    );
  }

  if (req.reset_token_used_at) {
    return NextResponse.json(
      {
        success: false,
        code: 'used',
        message: 'Lyen sa a deja itilize. Si ou bezwen yon lòt, kontakte asistans lan.',
      },
      { status: 410 }
    );
  }

  const expMs = Date.parse(String(req.reset_token_expires_at || ''));
  if (!Number.isFinite(expMs) || expMs <= Date.now()) {
    return NextResponse.json(
      {
        success: false,
        code: 'expired',
        message:
          'Lyen an ekspire (li te valab 1 èdtan). Kontakte asistans lan pou yo verifye w ankò epi voye yon nouvo lyen.',
      },
      { status: 410 }
    );
  }

  if (!req.user_id) {
    return NextResponse.json(
      { success: false, message: 'Kont lan pa jwenn. Kontakte asistans lan.' },
      { status: 404 }
    );
  }

  const { data: profile } = await db
    .from('profiles')
    .select('id, email, account_status')
    .eq('id', req.user_id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json(
      { success: false, message: 'Kont lan pa jwenn. Kontakte asistans lan.' },
      { status: 404 }
    );
  }
  if (profile.account_status === 'suspended') {
    return NextResponse.json(
      { success: false, message: 'Kont ou sispandi. Kontakte sipò a.' },
      { status: 403 }
    );
  }

  // ── Efase tout faktè MFA — kliyan an pral konfigire yon nouvo sou /mfa-setup
  try {
    const { data: factorsData } = await db.auth.admin.mfa.listFactors({ userId: profile.id });
    for (const f of factorsData?.factors || []) {
      await db.auth.admin.mfa.deleteFactor({ id: f.id, userId: profile.id });
    }
  } catch (e) {
    console.error('[recovery-redeem] delete factors:', e);
  }

  // ── Boule token an (yon sèl itilizasyon)
  await db
    .from('account_recovery_requests')
    .update({
      reset_token_used_at: new Date().toISOString(),
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.id);

  // ── Sesyon atravè magiclink token_hash
  const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email: String(profile.email || req.email).trim(),
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('[recovery-redeem] generateLink:', linkErr?.message);
    return NextResponse.json(
      { success: false, message: 'Pa t kapab kreye sesyon. Kontakte asistans lan.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    token_hash: linkData.properties.hashed_token,
    message: 'Verifikasyon reyisi! W ap konfigire yon nouvo kòd MFA kounye a.',
  });
}
