import { hashPin, verifyPin } from './hash';

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 30;

export type PinProfile = {
  id: string;
  email?: string;
  pin_code?: string | null;
  pin_code_hash?: string | null;
  transaction_pin?: string | null;
  transaction_pin_hash?: string | null;
  failed_pin_attempts?: number | null;
  pin_locked_until?: string | null;
  account_status?: string | null;
  pin_enabled?: boolean | null;
};

export function isPinLocked(profile: PinProfile): { locked: boolean; message?: string } {
  if (profile.account_status === 'suspended') {
    return { locked: true, message: 'Kont ou sispandi. Kontakte sipò a.' };
  }
  if (profile.pin_locked_until) {
    const until = new Date(profile.pin_locked_until).getTime();
    if (until > Date.now()) {
      const mins = Math.ceil((until - Date.now()) / 60000);
      return {
        locked: true,
        message: `Twòp erè PIN. Eseye ankò nan ${mins} minit.`,
      };
    }
  }
  return { locked: false };
}

export async function verifyWalletPin(profile: PinProfile, pin: string): Promise<boolean> {
  // Pa aksepte plaintext pin_code ankò — sèlman hash
  if (profile.pin_code_hash) {
    return verifyPin(pin, profile.pin_code_hash);
  }
  return false;
}

export async function verifyTransactionPin(profile: PinProfile, pin: string): Promise<boolean> {
  if (profile.transaction_pin_hash) {
    return verifyPin(pin, profile.transaction_pin_hash);
  }
  return false;
}

/** Aksepte PIN wallet OSWA PIN tranzaksyon (yon sèl PIN pou koneksyon + retrè/transfert). */
export async function verifyAnyPin(profile: PinProfile, pin: string): Promise<{
  ok: boolean;
  field: 'wallet' | 'transaction' | null;
}> {
  if (await verifyWalletPin(profile, pin)) {
    return { ok: true, field: 'wallet' };
  }
  if (await verifyTransactionPin(profile, pin)) {
    return { ok: true, field: 'transaction' };
  }
  return { ok: false, field: null };
}

export function hasAnyPin(profile: Pick<PinProfile, 'pin_code' | 'pin_code_hash' | 'transaction_pin' | 'transaction_pin_hash'>): boolean {
  return !!(profile.pin_code_hash || profile.transaction_pin_hash);
}

export async function buildPinFailureUpdate(currentAttempts: number) {
  const next = (currentAttempts || 0) + 1;
  if (next >= MAX_PIN_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + PIN_LOCK_MINUTES * 60 * 1000).toISOString();
    return {
      failed_pin_attempts: next,
      pin_locked_until: lockedUntil,
      update: { failed_pin_attempts: next, pin_locked_until: lockedUntil },
      message: `PIN pa bon. Kont ou bloke pou ${PIN_LOCK_MINUTES} minit.`,
      locked: true,
    };
  }
  return {
    failed_pin_attempts: next,
    update: { failed_pin_attempts: next },
    message: `PIN pa bon. Ou rete ${MAX_PIN_ATTEMPTS - next} chans.`,
    locked: false,
  };
}

export async function buildPinSuccessUpdate(
  _pin: string,
  _field: 'wallet' | 'transaction' | 'both' = 'both'
) {
  const hashed = await hashPin(_pin);
  // Toujou sync wallet + tranzaksyon pou yon sèl PIN (login + retrè/transfert)
  return {
    pin_code_hash: hashed,
    pin_code: null,
    pin_enabled: true,
    transaction_pin_hash: hashed,
    transaction_pin: null,
    failed_pin_attempts: 0,
    pin_locked_until: null as string | null,
  };
}

export async function buildPinMigrationUpdate(profile: PinProfile, pin: string, field: 'wallet' | 'transaction') {
  const hashed = await hashPin(pin);
  if (field === 'wallet') {
    return { pin_code_hash: hashed, pin_code: null };
  }
  return { transaction_pin_hash: hashed, transaction_pin: null };
}
