/**
 * CSP + antèt sekirite pou proxy.ts (Next.js 16).
 * Nonce pa request — script-src SAN 'unsafe-inline'.
 */

import type { NextResponse } from 'next/server';

export function createRequestNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isDev ? "'unsafe-eval'" : '',
    // Fallbacks pou navigatè ki pa sipòte strict-dynamic (CSP Level 2)
    'https://challenges.cloudflare.com',
    'https://static.cloudflareinsights.com',
  ]
    .filter(Boolean)
    .join(' ');

  const connectSrc = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://api.ipify.org',
    'https://api.telegram.org',
    'https://challenges.cloudflare.com',
    'https://cloudflareinsights.com',
    'https://static.cloudflareinsights.com',
    // MonCash / Digicel (redirect / API nan kèk koule)
    'https://*.moncashbutton.digicelgroup.com',
    'https://*.moncash.sh',
    isDev ? 'ws://localhost:* http://localhost:* ws://127.0.0.1:* http://127.0.0.1:*' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // style-src kenbe 'unsafe-inline' — Tailwind / style={{}} React; script-src se priyorite Observatory
  const styleSrc = ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'].join(' ');

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: blob: https://i.imgur.com https://*.imgur.com https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];

  return directives.join('; ').replace(/\s{2,}/g, ' ').trim();
}

export function applySecurityHeaders(
  response: NextResponse,
  nonce: string,
  opts?: { isDev?: boolean }
): NextResponse {
  const isDev = opts?.isDev ?? process.env.NODE_ENV !== 'production';
  const csp = buildContentSecurityPolicy(nonce, isDev);

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(), interest-cohort=()'
  );
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  if (!isDev) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  return response;
}
