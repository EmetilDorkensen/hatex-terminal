import { ADMIN_EMAIL } from '@/lib/admin/auth';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';

export const DEFAULT_LOGIN_CLOSED_MESSAGE =
  'Paj koneksyon an fèmen tanporèman. Nou ap travay sou sit la. Eseye ankò pita.';

export type LoginAccessState = {
  loginEnabled: boolean;
  message: string;
  /** Imèl ekstra admin ajoute (pa gen admin prensipal la — sa a toujou otorize). */
  bypassEmails: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeBypassEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidBypassEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeBypassEmail(email));
}

/** Admin prensipal + lis ekstra. */
export function canBypassLoginClose(
  email: string | null | undefined,
  bypassEmails: string[] = []
): boolean {
  const normalized = typeof email === 'string' ? normalizeBypassEmail(email) : '';
  if (!normalized) return false;
  if (normalized === ADMIN_EMAIL.toLowerCase()) return true;
  return bypassEmails.some((e) => normalizeBypassEmail(e) === normalized);
}

export function sanitizeBypassEmailList(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out = new Set<string>();
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const e = normalizeBypassEmail(item);
    if (!isValidBypassEmail(e)) continue;
    // Admin prensipal la toujou otorize — pa bezwen nan lis la.
    if (e === ADMIN_EMAIL.toLowerCase()) continue;
    out.add(e);
  }
  return Array.from(out).sort();
}

export async function getLoginAccessState(): Promise<LoginAccessState> {
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from('global_settings')
      .select('login_enabled, login_closed_message, login_bypass_emails')
      .eq('id', 1)
      .maybeSingle();

    const loginEnabled = data?.login_enabled !== false;
    const custom =
      typeof data?.login_closed_message === 'string' ? data.login_closed_message.trim() : '';
    return {
      loginEnabled,
      message: custom || DEFAULT_LOGIN_CLOSED_MESSAGE,
      bypassEmails: sanitizeBypassEmailList(data?.login_bypass_emails),
    };
  } catch {
    return {
      loginEnabled: true,
      message: DEFAULT_LOGIN_CLOSED_MESSAGE,
      bypassEmails: [],
    };
  }
}

export async function assertLoginAllowed(
  email?: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const state = await getLoginAccessState();
  if (state.loginEnabled) return { ok: true };
  if (canBypassLoginClose(email, state.bypassEmails)) return { ok: true };
  return { ok: false, message: state.message };
}
