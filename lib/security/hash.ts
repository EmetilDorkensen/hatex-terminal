import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BCRYPT_ROUNDS = 12;
const CARD_ENC_PREFIX = 'enc:v1:';

function getCardPepper(): string {
  const secret = process.env.CARD_HASH_SECRET || process.env.HATEX_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('CARD_HASH_SECRET pa konfigire sou sèvè a.');
  }
  return secret;
}

function getCardEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(getCardPepper()).digest();
}

/** Chiffre PAN/CVV at-rest (AES-256-GCM). Pa janm ekri tèks klè nan baz. */
export function encryptCardField(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCardEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${CARD_ENC_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString('base64url')}`;
}

export function decryptCardField(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(CARD_ENC_PREFIX)) {
    // Legacy plaintext — retounen pou migrasyon, men pa ekspoze nan nouvo ekri
    return stored;
  }
  try {
    const raw = Buffer.from(stored.slice(CARD_ENC_PREFIX.length), 'base64url');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getCardEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function isEncryptedCardField(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(CARD_ENC_PREFIX);
}

export function maskCardNumber(cardNumber: string | null | undefined): string {
  const clean = cleanCardNumber(cardNumber || '');
  if (clean.length < 4) return '****';
  return `**** **** **** ${clean.slice(-4)}`;
}

export function cleanCardNumber(card: string): string {
  return String(card).replace(/\D/g, '');
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}

export function hashCardNumber(cardNumber: string): string {
  const clean = cleanCardNumber(cardNumber);
  return crypto.createHmac('sha256', getCardPepper()).update(clean).digest('hex');
}

export async function hashCvv(cvv: string): Promise<string> {
  return bcrypt.hash(String(cvv), BCRYPT_ROUNDS);
}

export async function verifyCvv(cvv: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(String(cvv), hash);
}

export function cardLast4(cardNumber: string): string {
  const clean = cleanCardNumber(cardNumber);
  return clean.slice(-4);
}

export async function buildCardSecurityFields(cardNumber: string, cvv: string) {
  return {
    card_number_hash: hashCardNumber(cardNumber),
    cvv_hash: await hashCvv(cvv),
    card_last4: cardLast4(cardNumber),
  };
}
