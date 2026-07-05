import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { checkStrongPassword } from '@/lib/security/password-strength';
import { WORKSPACE_GATE_COOKIE, WORKSPACE_GATE_MAX_AGE_MS, signWorkspaceGateToken } from '@/lib/security/workspace-gate';

const BCRYPT_ROUNDS = 12;
const COOKIE_MAX_AGE = Math.floor(WORKSPACE_GATE_MAX_AGE_MS / 1000);

// Premye fwa yon anplwaye klike sou bouton "Aksè Espas Travay" la:
// li dwe kreye yon modpas fò espesyal (apa de modpas kont kliyan li).
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`workspace-set-password:${ip}`, 5, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte sou kont ou anvan.' }, { status: 401 });
  }

  const { password } = await request.json().catch(() => ({ password: '' }));
  const strength = checkStrongPassword(String(password || ''));
  if (!strength.valid) {
    return NextResponse.json({ success: false, message: strength.message }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const email = user.email.trim().toLowerCase();

  const { data: staff, error: staffErr } = await admin
    .from('staff_users')
    .select('id, workspace_password_hash, status')
    .eq('email', email)
    .maybeSingle();

  if (staffErr || !staff) {
    return NextResponse.json({ success: false, message: 'Ou pa nan lis anplwaye Hatexcard yo.' }, { status: 403 });
  }

  if (staff.workspace_password_hash) {
    return NextResponse.json(
      { success: false, message: 'Ou gentan gen yon modpas espas travay. Itilize l pou konekte.' },
      { status: 409 }
    );
  }

  const hash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);

  const { error: updateErr } = await admin
    .from('staff_users')
    .update({
      workspace_password_hash: hash,
      workspace_password_set_at: new Date().toISOString(),
      last_workspace_login_at: new Date().toISOString(),
      status: 'active',
    })
    .eq('id', staff.id);

  if (updateErr) {
    return NextResponse.json({ success: false, message: 'Erè pandan konfigirasyon modpas la.' }, { status: 500 });
  }

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
