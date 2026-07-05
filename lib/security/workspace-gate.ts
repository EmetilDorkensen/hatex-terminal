import crypto from 'crypto';

export const WORKSPACE_GATE_COOKIE = 'hatex_workspace_gate';
export const WORKSPACE_GATE_MAX_AGE_MS = 8 * 3600 * 1000; // 8 èdtan (yon jounen travay)

function getWorkspaceGateSecret(): string {
  return (
    process.env.WORKSPACE_GATE_SECRET ||
    process.env.ADMIN_GATE_SECRET ||
    process.env.ADMIN_GATE_PASSWORD ||
    ''
  );
}

/**
 * Siyen yon jeton gate ki mare ak imel espesifik anplwaye a — sa anpeche
 * yon anplwaye itilize cookie gate yon lòt anplwaye si yo pataje menm
 * navigatè a san yo pa dekonekte.
 */
export function signWorkspaceGateToken(email: string): string {
  const secret = getWorkspaceGateSecret();
  const normalizedEmail = email.trim().toLowerCase();
  const payload = `${Date.now()}.${Buffer.from(normalizedEmail).toString('base64url')}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyWorkspaceGateToken(token: string | undefined, email: string | undefined | null): boolean {
  if (!token || !email) return false;
  const secret = getWorkspaceGateSecret();
  if (!secret) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [ts, emailB64, sig] = parts;

  const payload = `${ts}.${emailB64}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (sig !== expected) return false;

  const age = Date.now() - Number(ts);
  if (!(age >= 0 && age <= WORKSPACE_GATE_MAX_AGE_MS)) return false;

  try {
    const decodedEmail = Buffer.from(emailB64, 'base64url').toString('utf8');
    return decodedEmail === email.trim().toLowerCase();
  } catch {
    return false;
  }
}
