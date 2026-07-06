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
