import { cookies } from 'next/headers';
import { ADMIN_GATE_COOKIE, verifyAdminGateToken } from '@/lib/security/admin-gate';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';

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
