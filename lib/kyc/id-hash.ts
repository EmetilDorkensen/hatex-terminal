import crypto from 'crypto';

function getKycPepper(): string {
  const secret = process.env.KYC_HASH_SECRET || process.env.CARD_HASH_SECRET;
  if (!secret) {
    throw new Error('KYC_HASH_SECRET oswa CARD_HASH_SECRET pa konfigire.');
  }
  return secret;
}

/** Nòmalize nimewo ID (CIN, paspò, elatriye) pou hash konsistan. */
export function normalizeIdNumber(raw: string): string {
  return String(raw).trim().toUpperCase().replace(/[\s\-]/g, '');
}

export function hashKycIdNumber(raw: string): string {
  const normalized = normalizeIdNumber(raw);
  if (!normalized) {
    throw new Error('Nimewo ID vid.');
  }
  return crypto.createHmac('sha256', getKycPepper()).update(normalized).digest('hex');
}

function aesKey(): Buffer {
  return crypto.createHash('sha256').update(`kyc-id:${getKycPepper()}`).digest();
}

/**
 * Chiffre nimewo ID an plen (AES-256-GCM) pou asistans/admin ka li l.
 * Fòma: "iv.tag.cipher" (base64). Pa ekspoze bay kliyan.
 */
export function encryptKycIdNumber(raw: string): string {
  const plain = String(raw).trim();
  if (!plain) throw new Error('Nimewo ID vid.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

/** Dekodaj — sèlman nan API admin/asistans. */
export function decryptKycIdNumber(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [ivB64, tagB64, dataB64] = String(payload).split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      aesKey(),
      Buffer.from(ivB64, 'base64')
    );
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
