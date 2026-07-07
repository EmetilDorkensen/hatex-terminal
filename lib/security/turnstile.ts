// Verifikasyon Cloudflare Turnstile (CAPTCHA). Si TURNSTILE_SECRET_KEY pa
// konfigire, fonksyon an "pase" otomatikman — CAPTCHA se yon kouch anplis,
// pa yon depandans obligatwa (lockout pa kont + rate limit pa IP rete aktif).
export async function verifyTurnstileToken(token: string | null | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json();
    return data?.success === true;
  } catch {
    return false;
  }
}

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}
