/**
 * Helpers UI-safe pou kle API — PA gen crypto, PA gen process.env sekrè.
 * Ka enpòte nan "use client" san yo pa rale lojik sèvè nan chunk navigatè a.
 */

export const API_KEY_PREFIX = 'hx_live_';
export const PUBLISHABLE_KEY_PREFIX = 'pk_live_';
export const API_KEY_PREFIX_DISPLAY_LEN = 12;

export function maskApiKey(prefix: string | null | undefined): string {
  if (!prefix) return `${API_KEY_PREFIX}••••••••••••`;
  return `${prefix}${'•'.repeat(24)}`;
}

export function maskPublishableKey(prefix: string | null | undefined): string {
  if (!prefix) return `${PUBLISHABLE_KEY_PREFIX}••••••••••••`;
  return `${prefix}${'•'.repeat(24)}`;
}

export function profileHasApiKey(profile: {
  api_key_hash?: string | null;
  api_key?: string | null;
  api_key_prefix?: string | null;
  has_api_key?: boolean | null;
} | null | undefined): boolean {
  if (!profile) return false;
  if (profile.has_api_key === true) return true;
  return !!(profile.api_key_hash || profile.api_key || profile.api_key_prefix);
}
