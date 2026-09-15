import crypto from 'crypto';

/**
 * Kòd aksè inik (rekiperasyon) — tankou Stripe.
 *
 * - Fòma: HTX-XXXX-XXXX-XXXX-XXXX (alfabè san karaktè konfizyon: pa gen 0/O/1/I/L)
 * - Verifikasyon: HMAC-SHA256 peppered (recovery_code_hash)
 * - Afichaj nan Paramèt: AES-256-GCM (recovery_code_enc) — dechifre sèlman apre step-up MFA
 * - Dire: 2 zan
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUPS = 4;
const GROUP_LEN = 4;

export const RECOVERY_CODE_TTL_MS = 2 * 365 * 24 * 60 * 60 * 1000; // 2 zan

function secretKey(): string {
  const s =
    process.env.RECOVERY_CODE_SECRET?.trim() ||
    process.env.CARD_HASH_SECRET?.trim() ||
    '';
  if (!s) throw new Error('RECOVERY_CODE_SECRET / CARD_HASH_SECRET pa konfigire.');
  return s;
}

export function generateRecoveryCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let part = '';
    const bytes = crypto.randomBytes(GROUP_LEN);
    for (let i = 0; i < GROUP_LEN; i++) {
      part += ALPHABET[bytes[i] % ALPHABET.length];
    }
    groups.push(part);
  }
  return `HTX-${groups.join('-')}`;
}

/** Retire espas/tirè, majiskil — pou konparezon ki tolere fòma. */
export function normalizeRecoveryCode(raw: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function hashRecoveryCode(code: string): string {
  return crypto
    .createHmac('sha256', secretKey())
    .update(normalizeRecoveryCode(code))
    .digest('hex');
}

export function verifyRecoveryCodeHash(code: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  const computed = hashRecoveryCode(code);
  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(String(storedHash), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function aesKey(): Buffer {
  return crypto.createHash('sha256').update(`recovery-code:${secretKey()}`).digest();
}

/** AES-256-GCM → "iv.tag.cipher" (base64) */
export function encryptRecoveryCode(code: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey(), iv);
  const enc = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptRecoveryCode(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [ivB64, tagB64, dataB64] = String(payload).split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch {
    return null;
  }
}

export function recoveryCodeExpiry(from = new Date()): Date {
  return new Date(from.getTime() + RECOVERY_CODE_TTL_MS);
}

// ─────────────────────────────────────────────────────────────
// Token rekiperasyon kont (lyen email 1 èdtan — reset MFA)
// ─────────────────────────────────────────────────────────────

export const RECOVERY_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 èdtan

/** Token URL-safe (64 hex chars) — voye nan lyen email la sèlman. */
export function generateRecoveryToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** HMAC-SHA256 — sèl fòm ki sere nan baz done a. */
export function hashRecoveryToken(token: string): string {
  return crypto
    .createHmac('sha256', secretKey())
    .update(`recovery-token:${String(token || '').trim()}`)
    .digest('hex');
}

export function recoveryTokenExpiry(from = new Date()): Date {
  return new Date(from.getTime() + RECOVERY_TOKEN_TTL_MS);
}

export function isRecoveryCodeExpired(expiresAt: string | Date | null | undefined): boolean {
  if (!expiresAt) return true;
  const t = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt.getTime();
  return !Number.isFinite(t) || t <= Date.now();
}
