import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';
import { ADMIN_GATE_COOKIE, verifyAdminGateToken } from '@/lib/security/admin-gate';

export const ADMIN_EMAIL = 'adminhatexcard@gmail.com';

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function isAdminWithGate(userEmail: string | undefined): Promise<boolean> {
  if (userEmail !== ADMIN_EMAIL) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_GATE_COOKIE)?.value;
  return verifyAdminGateToken(token);
}

export async function isActiveStaff(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  const { supabase } = await getAuthenticatedUser();
  const { data: staff } = await supabase
    .from('staff_users')
    .select('id, status, workspace_password_hash')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  return Boolean(staff && staff.status !== 'revoked' && staff.workspace_password_hash);
}

export async function canViewKycDocuments(userEmail: string | undefined): Promise<boolean> {
  if (!userEmail) return false;
  if (userEmail === ADMIN_EMAIL && (await isAdminWithGate(userEmail))) return true;
  return isActiveStaff(userEmail);
}
