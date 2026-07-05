export interface PasswordStrengthResult {
  valid: boolean;
  message?: string;
}

/**
 * Règ modpas fò pou Espas Travay (Workspace) anplwaye yo:
 * omwen 10 karaktè, yon majiskil, yon miniskil, yon chif, ak yon senbòl.
 */
export function checkStrongPassword(password: string): PasswordStrengthResult {
  if (!password || password.length < 10) {
    return { valid: false, message: 'Modpas la dwe genyen omwen 10 karaktè.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Modpas la dwe genyen omwen yon lèt majiskil (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Modpas la dwe genyen omwen yon lèt miniskil (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Modpas la dwe genyen omwen yon chif (0-9).' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: 'Modpas la dwe genyen omwen yon senbòl (!@#$%...).' };
  }
  return { valid: true };
}
