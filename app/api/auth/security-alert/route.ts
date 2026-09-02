import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { sendSecurityAlertEmail, type SecurityEventKind } from '@/lib/notify/email';

/**
 * POST /api/auth/security-alert
 * Body: { kind: 'password_changed' }
 *
 * Paj yo rele wout sa a apre yon operasyon sekirite reyisi (egz. chanje
 * modpas la) pou voye alèt la nan imèl sesyon an. PIN yo voye dirèkteman
 * depi /api/auth/pin (sèvè) — wout sa a sèvi pou aksyon ki fèt kliyan bò.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`security-alert:${ip}`, 10, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const ALLOWED: SecurityEventKind[] = ['password_changed'];

  const body = await request.json().catch(() => ({}));
  const kind = String(body?.kind || '');
  if (!ALLOWED.includes(kind as SecurityEventKind)) {
    return NextResponse.json({ success: false, message: 'Kalite alèt pa valab.' }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
    }

    // sendSecurityAlertEmail pa janm jete — li loje erè yo.
    await sendSecurityAlertEmail(user.email, kind as SecurityEventKind);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(
      'Erè security-alert:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
