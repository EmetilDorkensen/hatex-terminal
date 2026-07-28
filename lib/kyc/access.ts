import { cookies } from 'next/headers';
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from '@/lib/security/supabase-server';
import { ADMIN_GATE_COOKIE, verifyAdminGateToken } from '@/lib/security/admin-gate';
import { WORKSPACE_GATE_COOKIE, verifyWorkspaceGateToken } from '@/lib/security/workspace-gate';

export const ADMIN_EMAIL = 'adminhatexcard@gmail.com';

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function isAdminWithGate(userEmail: string | undefined): Promise<boolean> {
  if (!userEmail || userEmail.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return false;
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_GATE_COOKIE)?.value;
  return verifyAdminGateToken(token);
}

export async function isActiveStaff(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  // service_role — pa konte sou RLS (staff ka pa wè pwòp liy nan kèk konfig)
  const admin = createSupabaseAdminClient();
  const { data: staff } = await admin
    .from('staff_users')
    .select('id, status, workspace_password_hash')
    .eq('email', email.trim().toLowerCase())
    .eq('status', 'active')
    .maybeSingle();

  return Boolean(staff?.workspace_password_hash);
}

/**
 * Admin + admin-gate, oswa admin/staff aktif + workspace-gate
 * (admin ka travay nan /workspace san admin-gate).
 */
export async function canViewKycDocuments(userEmail: string | undefined): Promise<boolean> {
  if (!userEmail) return false;
  const normalized = userEmail.trim().toLowerCase();
  const cookieStore = await cookies();

  if (normalized === ADMIN_EMAIL.toLowerCase()) {
    const adminToken = cookieStore.get(ADMIN_GATE_COOKIE)?.value;
    if (verifyAdminGateToken(adminToken)) return true;
    // Admin ka itilize workspace gate tou (tankou assertFinanceOperatorWithGate)
    const wsToken = cookieStore.get(WORKSPACE_GATE_COOKIE)?.value;
    if (verifyWorkspaceGateToken(wsToken, normalized)) return true;
    return false;
  }

  if (!(await isActiveStaff(userEmail))) return false;
  const wsToken = cookieStore.get(WORKSPACE_GATE_COOKIE)?.value;
  return verifyWorkspaceGateToken(wsToken, userEmail);
}
