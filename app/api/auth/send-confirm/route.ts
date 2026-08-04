import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { sendSignupConfirmEmail } from '@/lib/auth/send-confirm-email';

/**
 * Voye / renouvle imèl konfimasyon enskripsyon (Resend).
 * Body: { email }
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`send-confirm:${ip}`, 8, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  // Repons neutral (anti-enumerasyon)
  const genericOk = NextResponse.json({
    success: true,
    message: 'Si imèl sa a gen yon kont ki poko konfime, n ap voye yon nouvo lyen.',
  });

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return genericOk;
  }

  try {
    const admin = createSupabaseAdminClient();
    const result = await sendSignupConfirmEmail(admin, email);
    // Pa ekspoze si imèl la egziste oswa non
    if (!result.ok) return genericOk;
    return genericOk;
  } catch (err: unknown) {
    console.error('Erè send-confirm:', err instanceof Error ? err.message : err);
    return genericOk;
  }
}
