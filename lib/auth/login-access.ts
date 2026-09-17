import { ADMIN_EMAIL } from '@/lib/admin/auth';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';

export const DEFAULT_LOGIN_CLOSED_MESSAGE =
  'Paj koneksyon an fèmen tanporèman. Nou ap travay sou sit la. Eseye ankò pita.';

export type LoginAccessState = {
  loginEnabled: boolean;
  message: string;
};

export function isAdminLoginEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export async function getLoginAccessState(): Promise<LoginAccessState> {
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from('global_settings')
      .select('login_enabled, login_closed_message')
      .eq('id', 1)
      .maybeSingle();

    const loginEnabled = data?.login_enabled !== false;
    const custom =
      typeof data?.login_closed_message === 'string' ? data.login_closed_message.trim() : '';
    return {
      loginEnabled,
      message: custom || DEFAULT_LOGIN_CLOSED_MESSAGE,
    };
  } catch {
    // Si baz la pa reponn, pa bloke sit la nèt — kite koneksyon louvri.
    return { loginEnabled: true, message: DEFAULT_LOGIN_CLOSED_MESSAGE };
  }
}

export async function assertLoginAllowed(
  email?: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const state = await getLoginAccessState();
  if (state.loginEnabled) return { ok: true };
  if (isAdminLoginEmail(email)) return { ok: true };
  return { ok: false, message: state.message };
}
