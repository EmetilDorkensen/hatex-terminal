import { createCipheriv, createDecipheriv, createHash, createHmac, timingSafeEqual } from 'crypto';

/** Legacy payment_tokens.id = 32 hex chars */
const LEGACY_HEX_RE = /^[0-9a-f]{32}$/i;

function secret(): string {
  return (
    process.env.QR_PAYMENT_SECRET ||
    process.env.RESERVATION_SHARE_SECRET ||
    process.env.CARD_HASH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'hatex-qr-dev'
  );
}

function getKey(): Buffer {
  return createHash('sha256').update(`hatex-qr-v1:${secret()}`).digest();
}

function deterministicIv(paymentTokenId: string): Buffer {
  return createHmac('sha256', getKey()).update(`qr-iv:${paymentTokenId}`).digest().subarray(0, 12);
}

/** Token opake pou URL QR — pa ekspoze id payment_tokens / machann. */
export function encryptQrPaymentToken(paymentTokenId: string): string {
  const id = String(paymentTokenId || '').trim();
  if (!LEGACY_HEX_RE.test(id)) {
    throw new Error('payment token id pa valab.');
  }
  const key = getKey();
  const iv = deterministicIv(id);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(id, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptQrPaymentToken(token: string): string | null {
  const rawToken = String(token || '').trim();
  if (!rawToken || LEGACY_HEX_RE.test(rawToken)) return null;
  try {
    const raw = Buffer.from(rawToken, 'base64url');
    if (raw.length < 12 + 16 + 8) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    const id = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    if (!LEGACY_HEX_RE.test(id)) return null;
    const expectedIv = deterministicIv(id);
    if (iv.length !== expectedIv.length || !timingSafeEqual(iv, expectedIv)) return null;
    return id;
  } catch {
    return null;
  }
}

/** Aksepte token kriple (nouvo QR) oswa hex (ansyen QR). */
export function resolveQrPaymentTokenId(token: string | null | undefined): string | null {
  const t = String(token || '').trim();
  if (!t) return null;
  const decrypted = decryptQrPaymentToken(t);
  if (decrypted) return decrypted;
  if (LEGACY_HEX_RE.test(t)) return t.toLowerCase();
  return null;
}
