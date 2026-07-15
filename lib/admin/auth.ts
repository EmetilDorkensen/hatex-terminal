import { cookies } from 'next/headers';
import { ADMIN_GATE_COOKIE, verifyAdminGateToken } from '@/lib/security/admin-gate';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { WORKSPACE_GATE_COOKIE, verifyWorkspaceGateToken } from '@/lib/security/workspace-gate';

export const ADMIN_EMAIL = 'adminhatexcard@gmail.com';

export async function requireAdminUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    return null;
  }

  return { supabase, user };
}

export async function hasValidAdminGate(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_GATE_COOKIE)?.value;
  return verifyAdminGateToken(token);
}

export function verifyAdminPassword(password: string): boolean {
  const gatePassword = process.env.ADMIN_GATE_PASSWORD;
  if (!gatePassword) return false;
  return password === gatePassword;
}

/** Admin ak gate cookie, oswa staff aktif ak workspace gate. */
export async function assertFinanceOperatorWithGate(
  email: string | undefined
): Promise<{ ok: true; role: 'admin' | 'staff' } | { ok: false }> {
  if (!email) return { ok: false };
  const normalized = email.trim().toLowerCase();
  const cookieStore = await cookies();

  if (normalized === ADMIN_EMAIL.toLowerCase()) {
    const token = cookieStore.get(ADMIN_GATE_COOKIE)?.value;
    if (!verifyAdminGateToken(token)) return { ok: false };
    return { ok: true, role: 'admin' };
  }

  const admin = createSupabaseAdminClient();
  const { data: staff } = await admin
    .from('staff_users')
    .select('id')
    .eq('email', normalized)
    .eq('status', 'active')
    .maybeSingle();

  if (!staff) return { ok: false };

  const wsToken = cookieStore.get(WORKSPACE_GATE_COOKIE)?.value;
  if (!verifyWorkspaceGateToken(wsToken, normalized)) return { ok: false };
  return { ok: true, role: 'staff' };
}
