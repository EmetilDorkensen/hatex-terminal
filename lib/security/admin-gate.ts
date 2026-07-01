import crypto from 'crypto';

export const ADMIN_GATE_COOKIE = 'hatex_admin_gate';
export const ADMIN_GATE_MAX_AGE_MS = 3600 * 1000;

export function verifyAdminGateToken(token: string | undefined): boolean {
  if (!token) return false;
  const secret = process.env.ADMIN_GATE_SECRET || process.env.ADMIN_GATE_PASSWORD || '';
  if (!secret) return false;

  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (sig !== expected) return false;

  const age = Date.now() - Number(payload);
  return age >= 0 && age <= ADMIN_GATE_MAX_AGE_MS;
}
