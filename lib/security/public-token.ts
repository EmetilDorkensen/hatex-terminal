import { createCipheriv, createDecipheriv, createHash, createHmac, timingSafeEqual } from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function secret(): string {
  return (
    process.env.PUBLIC_LINK_SECRET ||
    process.env.RESERVATION_SHARE_SECRET ||
    process.env.CARD_HASH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'hatex-public-link-dev'
  );
}

function getKey(): Buffer {
  return createHash('sha256').update(`hatex-public-v1:${secret()}`).digest();
}

function deterministicIv(value: string): Buffer {
  return createHmac('sha256', getKey()).update(`pub-iv:${value}`).digest().subarray(0, 12);
}

/** Token opake AES-256-GCM pou lyen piblik (subscribe, pataje, elatriye). */
export function encryptPublicId(id: string): string {
  const value = String(id || '').trim();
  if (!value) throw new Error('id obligatwa pou token piblik.');
  const key = getKey();
  const iv = deterministicIv(value);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptPublicId(token: string): string | null {
  const rawToken = String(token || '').trim();
  if (!rawToken) return null;

  // Legacy btoa (base64) — toujou sipòte pou lyen ki deja pibliye
  try {
    const legacy = Buffer.from(decodeURIComponent(rawToken), 'base64').toString('utf8');
    if (UUID_RE.test(legacy)) return legacy;
  } catch {
    // pa legacy
  }

  try {
    const raw = Buffer.from(rawToken, 'base64url');
    if (raw.length < 12 + 16 + 1) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    const id = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    if (!id) return null;
    const expectedIv = deterministicIv(id);
    if (iv.length !== expectedIv.length || !timingSafeEqual(iv, expectedIv)) return null;
    return id;
  } catch {
    return null;
  }
}
