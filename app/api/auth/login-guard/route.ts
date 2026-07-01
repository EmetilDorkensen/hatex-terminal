import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`login-guard:${ip}`, 15, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { allowed: false, message: `Twòp tantativ koneksyon. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }
  return NextResponse.json({ allowed: true });
}
