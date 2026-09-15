import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  verifyRecoveryCodeHash,
  isRecoveryCodeExpired,
  normalizeRecoveryCode,
} from '@/lib/security/recovery-code';

export const dynamic = 'force-dynamic';

/**
 * Koneksyon ak kòd aksè inik (rekiperasyon) — tankou Stripe.
 *
 * Si kliyan an efase/pèdi MFA li (oswa bliye modpas/PIN), li antre email + kòd aksè.
 * Si kòd la bon epi li poko ekspire:
 *   1. Nou efase tout faktè MFA yo (pou li ka re-anrejistre yon nouvo)
 *   2. Kòd la boule (yon sèl itilizasyon)
 *   3. Nou retounen yon token_hash magiclink → kliyan an verifyOtp → sesyon
 *   4. proxy.ts ap voye l sou /mfa-setup pou konfigire yon nouvo MFA
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`recovery-login:${ip}`, 5, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body.code === 'string' ? body.code : '';

  if (!email || !email.includes('@') || normalizeRecoveryCode(code).length < 16) {
    return NextResponse.json(
      { success: false, message: 'Email oswa kòd aksè pa valab.' },
      { status: 400 }
    );
  }

  const db = createSupabaseAdminClient();

  const { data: profiles } = await db
    .from('profiles')
    .select(
      'id, email, account_status, recovery_code_hash, recovery_code_expires_at, recovery_code_used_at'
    )
    .ilike('email', email)
    .limit(5);

  const profile =
    profiles?.find((p) => String(p.email || '').trim().toLowerCase() === email) || profiles?.[0];

  // Menm mesaj jenerik pou tout echèk — pa devwale si kont lan egziste
  const genericFail = NextResponse.json(
    { success: false, message: 'Email oswa kòd aksè pa bon, oswa kòd la ekspire.' },
    { status: 401 }
  );

  if (!profile?.recovery_code_hash) return genericFail;
  if (profile.recovery_code_used_at) return genericFail;
  if (isRecoveryCodeExpired(profile.recovery_code_expires_at)) return genericFail;
  if (!verifyRecoveryCodeHash(code, profile.recovery_code_hash)) return genericFail;

  if (profile.account_status === 'suspended') {
    return NextResponse.json(
      { success: false, message: 'Kont ou sispandi. Kontakte sipò a.' },
      { status: 403 }
    );
  }

  // ── 1. Efase tout faktè MFA yo — kliyan an pral re-anrejistre yon nouvo
  try {
    const { data: factorsData } = await db.auth.admin.mfa.listFactors({
      userId: profile.id,
    });
    for (const f of factorsData?.factors || []) {
      await db.auth.admin.mfa.deleteFactor({ id: f.id, userId: profile.id });
    }
  } catch (e) {
    console.error('[recovery-login] delete factors:', e);
    // Kontinye — si pa gen faktè, pa gen pwoblèm
  }

  // ── 2. Boule kòd la (yon sèl itilizasyon)
  await db
    .from('profiles')
    .update({
      recovery_code_hash: null,
      recovery_code_enc: null,
      recovery_code_used_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  // ── 3. Kreye sesyon atravè magiclink token_hash (menm modèl ak PIN login)
  const sessionEmail = String(profile.email || email).trim();
  const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email: sessionEmail,
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('[recovery-login] generateLink:', linkErr?.message);
    return NextResponse.json(
      { success: false, message: 'Pa t kapab kreye sesyon. Eseye ankò oswa kontakte sipò.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    token_hash: linkData.properties.hashed_token,
    message:
      'Kòd aksè verifye. MFA ou reyinisyalize — w ap konfigire yon nouvo kòd MFA kounye a. Kòd aksè a itilize; jenere yon nouvo nan Paramèt.',
  });
}
