import crypto from 'node:crypto';
import { timingSafeEqualString } from '@/lib/security/timing';

export const ADMIN_GATE_COOKIE = 'hatex_admin_gate';
export const ADMIN_GATE_MAX_AGE_MS = 3600 * 1000;

function getAdminGateSecret(): string {
  // Pa reuse modpas gate a kòm secret HMAC si ADMIN_GATE_SECRET manke —
  // men kenbe fallback pou pa kraze deplwaman ki pa genyen l ankò.
  return process.env.ADMIN_GATE_SECRET || process.env.ADMIN_GATE_PASSWORD || '';
}

export function signAdminGateToken(): string {
  const secret = getAdminGateSecret();
  const payload = `${Date.now()}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyAdminGateToken(token: string | undefined): boolean {
  if (!token) return false;
  const secret = getAdminGateSecret();
  if (!secret) return false;

  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (!timingSafeEqualString(sig, expected)) return false;

  const age = Date.now() - Number(payload);
  return age >= 0 && age <= ADMIN_GATE_MAX_AGE_MS;
}
