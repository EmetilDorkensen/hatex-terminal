import Script from 'next/script';
import { headers } from 'next/headers';

/** Script Turnstile ak nonce CSP (Server Component). */
export default async function TurnstileScript() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <Script
      src="https://challenges.cloudflare.com/turnstile/v0/api.js"
      strategy="lazyOnload"
      nonce={nonce}
    />
  );
}
