/**
 * Validate HTTP(S) URLs before img src / window.open / location redirects.
 * Blocks javascript:, data:, vbscript:, and untrusted hosts for media.
 */

const TRUSTED_MEDIA_HOST_SUFFIXES = [
  'supabase.co',
  'supabase.in',
  'hatexcard.com',
  'imgur.com',
  'i.imgur.com',
] as const;

function parseHttpUrl(raw: string | null | undefined): URL | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || /^\s*javascript:/i.test(trimmed) || /^\s*data:/i.test(trimmed)) {
    return null;
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

function hostAllowed(hostname: string, suffixes: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return true;
  return suffixes.some((s) => host === s || host.endsWith(`.${s}`));
}

/** True if string is a normal http(s) URL (for opening docs / redirects). */
export function isSafeHttpUrl(raw: string | null | undefined): boolean {
  return parseHttpUrl(raw) !== null;
}

/** Avatar / logo: only known storage / CDN hosts. */
export function isTrustedMediaUrl(raw: string | null | undefined): boolean {
  const u = parseHttpUrl(raw);
  if (!u) return false;
  return hostAllowed(u.hostname, TRUSTED_MEDIA_HOST_SUFFIXES);
}

/** Safe src for <img>, or undefined if untrusted. */
export function safeMediaSrc(raw: string | null | undefined): string | undefined {
  return isTrustedMediaUrl(raw) ? raw!.trim() : undefined;
}

/** Normalized http(s) URL or null. */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  const u = parseHttpUrl(raw);
  return u ? u.toString() : null;
}

/**
 * Open URL in new tab only if http(s). Returns false if blocked.
 */
export function openSafeUrl(raw: string | null | undefined): boolean {
  const url = safeExternalUrl(raw);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * Post-payment redirect: https preferred; relative same-origin paths allowed.
 */
export function safeRedirect(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    window.location.assign(trimmed);
    return true;
  }

  const u = parseHttpUrl(trimmed);
  if (!u) return false;
  // Prefer https for external merchant return URLs
  if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
    return false;
  }
  window.location.assign(u.toString());
  return true;
}
