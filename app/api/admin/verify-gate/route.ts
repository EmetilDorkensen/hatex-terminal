import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';
import {
  ADMIN_GATE_COOKIE,
  ADMIN_GATE_MAX_AGE_MS,
  signAdminGateToken,
  verifyAdminGateToken,
} from '@/lib/security/admin-gate';
import { ADMIN_EMAIL, verifyAdminPassword } from '@/lib/admin/auth';
import { cookieSecureFlag } from '@/lib/security/timing';

const COOKIE_MAX_AGE = Math.floor(ADMIN_GATE_MAX_AGE_MS / 1000);

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-gate:${ip}`, 5, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  if (!process.env.ADMIN_GATE_PASSWORD) {
    return NextResponse.json({ success: false, message: 'ADMIN_GATE_PASSWORD pa konfigire.' }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, message: 'Ou pa konekte. Konekte sou /login anvan.' },
      { status: 403 }
    );
  }
  if (user.email?.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ success: false, message: 'Kont sa a pa gen dwa admin.' }, { status: 403 });
  }

  const { password } = await request.json().catch(() => ({}));
  if (!verifyAdminPassword(typeof password === 'string' ? password : '')) {
    return NextResponse.json({ success: false, message: 'Modpas pa bon.' }, { status: 401 });
  }

  const token = signAdminGateToken();
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_GATE_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecureFlag(request.url),
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_GATE_COOKIE)?.value;
  if (!verifyAdminGateToken(token)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  return NextResponse.json({ success: true });
}
