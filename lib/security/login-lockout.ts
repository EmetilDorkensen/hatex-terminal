export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_MINUTES = 15;
export const CAPTCHA_AFTER_ATTEMPTS = 2;

export type LoginLockProfile = {
  id: string;
  failed_login_attempts?: number | null;
  login_locked_until?: string | null;
  account_status?: string | null;
};

export function isLoginLocked(profile: LoginLockProfile): { locked: boolean; message?: string } {
  if (profile.login_locked_until) {
    const until = new Date(profile.login_locked_until).getTime();
    if (until > Date.now()) {
      const mins = Math.ceil((until - Date.now()) / 60000);
      return { locked: true, message: `Twòp tantativ koneksyon. Eseye ankò nan ${mins} minit.` };
    }
  }
  return { locked: false };
}

export function buildLoginFailureUpdate(currentAttempts: number) {
  const next = (currentAttempts || 0) + 1;
  if (next >= MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000).toISOString();
    return {
      update: { failed_login_attempts: next, login_locked_until: lockedUntil },
      message: `Twòp tantativ echwe. Kont ou bloke pou ${LOGIN_LOCK_MINUTES} minit.`,
      locked: true,
      attempts: next,
    };
  }
  return {
    update: { failed_login_attempts: next },
    message: `Modpas pa bon. Ou rete ${MAX_LOGIN_ATTEMPTS - next} chans.`,
    locked: false,
    attempts: next,
  };
}

export const loginSuccessUpdate = { failed_login_attempts: 0, login_locked_until: null };
