import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { assertLoginAllowed, getLoginAccessState } from '@/lib/auth/login-access';

export const dynamic = 'force-dynamic';

/** Estati piblik: èske paj koneksyon an louvri? */
export async function GET() {
  const state = await getLoginAccessState();
  return NextResponse.json({
    login_enabled: state.loginEnabled,
    message: state.message,
  });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`login-guard:${ip}`, 15, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { allowed: false, message: `Twòp tantativ koneksyon. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  const access = await assertLoginAllowed(email || null);
  if (!access.ok) {
    return NextResponse.json(
      { allowed: false, login_closed: true, message: access.message },
      { status: 503 }
    );
  }

  return NextResponse.json({ allowed: true, login_enabled: true });
}
