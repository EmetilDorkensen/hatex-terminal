import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/security/supabase-server';
import {
  WORKSPACE_GATE_COOKIE,
  WORKSPACE_GATE_MAX_AGE_MS,
  signWorkspaceGateToken,
  verifyWorkspaceGateToken,
} from '@/lib/security/workspace-gate';

const COOKIE_MAX_AGE = Math.floor(WORKSPACE_GATE_MAX_AGE_MS / 1000);

// Anplwaye a antre modpas espas travay li (menm imel, modpas apa) pou l
// jwenn aksè nan /workspace. Rate-limited kont atak brit fòs.
export async function POST(request: Request) {
  const ip = getClientIp(request);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte sou kont ou anvan.' }, { status: 401 });
  }

  const email = user.email.trim().toLowerCase();
  const rl = await rateLimit(`workspace-gate:${email}:${ip}`, 5, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const { password } = await request.json().catch(() => ({ password: '' }));
  if (!password) {
    return NextResponse.json({ success: false, message: 'Antre modpas espas travay ou.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: staff, error: staffErr } = await admin
    .from('staff_users')
    .select('id, workspace_password_hash, status')
    .eq('email', email)
    .maybeSingle();

  if (staffErr || !staff) {
    return NextResponse.json({ success: false, message: 'Ou pa nan lis anplwaye Hatexcard yo.' }, { status: 403 });
  }

  if (staff.status === 'revoked') {
    return NextResponse.json({ success: false, message: 'Aksè espas travay ou revoke.' }, { status: 403 });
  }

  if (!staff.workspace_password_hash) {
    return NextResponse.json(
      { success: false, message: 'Ou poko gen yon modpas espas travay. Kreye youn dabò.', needsSetup: true },
      { status: 409 }
    );
  }

  const match = await bcrypt.compare(String(password), staff.workspace_password_hash);
  if (!match) {
    return NextResponse.json({ success: false, message: 'Modpas espas travay la pa bon.' }, { status: 401 });
  }

  await admin.from('staff_users').update({ last_workspace_login_at: new Date().toISOString() }).eq('id', staff.id);

  const token = signWorkspaceGateToken(email);
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return NextResponse.json({ success: true });
}

// Verifye si cookie gate ki deja la a valid toujou (itilize pa paj /workspace).
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(WORKSPACE_GATE_COOKIE)?.value;
  if (!verifyWorkspaceGateToken(token, user.email)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  return NextResponse.json({ success: true });
}

// Dekonekte nan espas travay la (efase cookie gate la imedyatman).
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_GATE_COOKIE, '', { path: '/', maxAge: 0 });
  return NextResponse.json({ success: true });
}
