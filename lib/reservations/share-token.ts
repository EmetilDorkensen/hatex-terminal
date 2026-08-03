import { createCipheriv, createDecipheriv, createHash, createHmac, timingSafeEqual } from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Legacy: encode(gen_random_bytes(16), 'hex') */
const LEGACY_HEX_RE = /^[0-9a-f]{32}$/i;

function secret(): string {
  return (
    process.env.RESERVATION_SHARE_SECRET ||
    process.env.CARD_HASH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'hatex-reservation-dev'
  );
}

function getShareKey(): Buffer {
  return createHash('sha256').update(`hatex-share-v1:${secret()}`).digest();
}

/** IV stab pou menm machann → menm lyen pataje. */
function deterministicIv(userId: string): Buffer {
  return createHmac('sha256', getShareKey()).update(`share-iv:${userId}`).digest().subarray(0, 12);
}

/**
 * Token opake AES-256-GCM — ID machann pa li nan URL san kle sèvè.
 * Fòma: base64url(iv || tag || ciphertext)
 */
export function encryptMerchantShareToken(userId: string): string {
  if (!UUID_RE.test(userId)) {
    throw new Error('userId pa valab pou share token.');
  }
  const key = getShareKey();
  const iv = deterministicIv(userId);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(userId, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptMerchantShareToken(token: string): string | null {
  const rawToken = String(token || '').trim();
  if (!rawToken || LEGACY_HEX_RE.test(rawToken)) return null;
  try {
    const raw = Buffer.from(rawToken, 'base64url');
    if (raw.length < 12 + 16 + 8) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', getShareKey(), iv);
    decipher.setAuthTag(tag);
    const userId = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    if (!UUID_RE.test(userId)) return null;
    // Verify IV matches deterministic (anti-tamper / wrong key edge)
    const expectedIv = deterministicIv(userId);
    if (iv.length !== expectedIv.length || !timingSafeEqual(iv, expectedIv)) return null;
    return userId;
  } catch {
    return null;
  }
}

export function isLegacyShareToken(token: string | null | undefined): boolean {
  return !!token && LEGACY_HEX_RE.test(String(token));
}

export function isEncryptedShareToken(token: string | null | undefined): boolean {
  if (!token || LEGACY_HEX_RE.test(token)) return false;
  return decryptMerchantShareToken(token) !== null;
}

/** @deprecated use encryptMerchantShareToken */
export function signMerchantShareToken(userId: string): string {
  return encryptMerchantShareToken(userId);
}

/** @deprecated use decryptMerchantShareToken */
export function verifyMerchantShareToken(token: string): string | null {
  return decryptMerchantShareToken(token);
}
