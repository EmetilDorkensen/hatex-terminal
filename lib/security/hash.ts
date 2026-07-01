import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BCRYPT_ROUNDS = 12;

function getCardPepper(): string {
  const secret = process.env.CARD_HASH_SECRET || process.env.HATEX_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('CARD_HASH_SECRET pa konfigire sou sèvè a.');
  }
  return secret;
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
