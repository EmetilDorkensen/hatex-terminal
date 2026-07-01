import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';
import { ADMIN_GATE_COOKIE, ADMIN_GATE_MAX_AGE_MS, verifyAdminGateToken } from '@/lib/security/admin-gate';

const ADMIN_EMAIL = 'hatexcard@gmail.com';
const COOKIE_MAX_AGE = Math.floor(ADMIN_GATE_MAX_AGE_MS / 1000);

function signGateToken(): string {
  const secret = process.env.ADMIN_GATE_SECRET || process.env.ADMIN_GATE_PASSWORD || '';
  const payload = `${Date.now()}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-gate:${ip}`, 5, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const gatePassword = process.env.ADMIN_GATE_PASSWORD;
  if (!gatePassword) {
    return NextResponse.json({ success: false, message: 'ADMIN_GATE_PASSWORD pa konfigire.' }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ success: false, message: 'Aksè refize.' }, { status: 403 });
  }

  const { password } = await request.json();
  if (password !== gatePassword) {
    return NextResponse.json({ success: false, message: 'Modpas pa bon.' }, { status: 401 });
  }

  const token = signGateToken();
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
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
