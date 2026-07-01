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
  if (profile.pin_code_hash) {
    return verifyPin(pin, profile.pin_code_hash);
  }
  if (profile.pin_code) {
    return profile.pin_code === pin;
  }
  return false;
}

export async function verifyTransactionPin(profile: PinProfile, pin: string): Promise<boolean> {
  if (profile.transaction_pin_hash) {
    return verifyPin(pin, profile.transaction_pin_hash);
  }
  if (profile.transaction_pin) {
    return profile.transaction_pin === pin;
  }
  return false;
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

export async function buildPinSuccessUpdate(pin: string, field: 'wallet' | 'transaction') {
  const hashed = await hashPin(pin);
  if (field === 'wallet') {
    return {
      pin_code_hash: hashed,
      pin_code: null,
      pin_enabled: true,
      failed_pin_attempts: 0,
      pin_locked_until: null,
    };
  }
  return {
    transaction_pin_hash: hashed,
    transaction_pin: null,
    failed_pin_attempts: 0,
    pin_locked_until: null,
  };
}

export async function buildPinMigrationUpdate(profile: PinProfile, pin: string, field: 'wallet' | 'transaction') {
  const hashed = await hashPin(pin);
  if (field === 'wallet') {
    return { pin_code_hash: hashed, pin_code: null };
  }
  return { transaction_pin_hash: hashed, transaction_pin: null };
}
