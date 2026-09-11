import crypto from 'node:crypto';

/** Konpare de string san revele longè/valè (timing-safe). */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Konpare ak tèt li pou pa revele longè atravè tan an.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Cookie secure lè HTTPS / pwodiksyon. */
export function cookieSecureFlag(requestUrl?: string): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  if (requestUrl?.startsWith('https://')) return true;
  return process.env.VERCEL === '1';
}
