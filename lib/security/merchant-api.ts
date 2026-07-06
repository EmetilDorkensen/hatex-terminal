import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashApiKey } from '@/lib/security/api-key';
import { hashCardNumber } from '@/lib/security/hash';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';

/** Headers sekirite pou tout repons API machann (sèvè-a-sèvè). */
export const MERCHANT_API_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Permissions-Policy': 'interest-cohort=()',
};

export function merchantApiJson(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...MERCHANT_API_SECURITY_HEADERS,
      ...(extraHeaders || {}),
    },
  });
}

/**
 * API machann se sèlman sèvè-a-sèvè — bloke demann ki soti nan navigatè kliyan
 * (JavaScript sou sit entènèt) pou evite volè kle API / kat.
 */
export function isUntrustedBrowserRequest(request: Request): boolean {
  const secFetchMode = request.headers.get('sec-fetch-mode');
  if (secFetchMode === 'cors' || secFetchMode === 'navigate') return true;

  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') return true;

  const origin = request.headers.get('origin');
  if (!origin) return false;

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://hatexcard.com';
  try {
    const originHost = new URL(origin).hostname.replace(/^www\./, '');
    const siteHost = new URL(site).hostname.replace(/^www\./, '');
    if (originHost === siteHost) return false;
    if (originHost.endsWith('.hatexcard.com') || siteHost.endsWith('.hatexcard.com')) {
      return !originHost.endsWith('hatexcard.com');
    }
    return true;
  } catch {
    return true;
  }
}

export async function rateLimitMerchantIp(
  request: Request,
  namespace: string,
  limit: number,
  windowSec: number
) {
  const ip = getClientIp(request);
  return rateLimit(`${namespace}:ip:${ip}`, limit, windowSec);
}

export async function rateLimitMerchantApiKey(apiKey: string, limit: number, windowSec: number) {
  const digest = hashApiKey(apiKey).slice(0, 20);
  return rateLimit(`merchant-api:key:${digest}`, limit, windowSec);
}

export async function rateLimitInvalidApiKey(ip: string) {
  return rateLimit(`merchant-api:bad-key:${ip}`, 20, 300);
}

/** Menm modèl ak verify-card: limit tantativ pa nimewo kat (anti brute-force). */
export async function rateLimitCardPaymentAttempts(cardNumber: string) {
  const cardHash = hashCardNumber(cardNumber);
  return rateLimit(`merchant-api:card:${cardHash}`, 6, 900);
}

export function parseBearerApiKey(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token.startsWith('hx_live_') || token.length < 20) return null;
  return token;
}

type IdempotencyClaim =
  | { status: 'new' }
  | { status: 'replay'; body: Record<string, unknown> }
  | { status: 'in_progress' };

/** Rezève Idempotency-Key anvan RPC pou evite doub peman nan kous. */
export async function claimIdempotencyKey(
  supabase: SupabaseClient,
  merchantId: string,
  idempotencyKey: string
): Promise<IdempotencyClaim> {
  const { error: insertErr } = await supabase.from('api_idempotency_keys').insert({
    merchant_id: merchantId,
    idempotency_key: idempotencyKey,
    response_body: { _pending: true, at: new Date().toISOString() },
  });

  if (!insertErr) return { status: 'new' };

  if (insertErr.code !== '23505') {
    throw insertErr;
  }

  const { data: existing } = await supabase
    .from('api_idempotency_keys')
    .select('response_body')
    .eq('merchant_id', merchantId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  const body = (existing?.response_body || {}) as Record<string, unknown>;
  if (body.success === true) {
    return { status: 'replay', body };
  }
  return { status: 'in_progress' };
}

export async function finalizeIdempotencyKey(
  supabase: SupabaseClient,
  merchantId: string,
  idempotencyKey: string,
  responseBody: Record<string, unknown>
) {
  await supabase
    .from('api_idempotency_keys')
    .update({ response_body: responseBody })
    .eq('merchant_id', merchantId)
    .eq('idempotency_key', idempotencyKey);
}

export async function releaseIdempotencyKey(
  supabase: SupabaseClient,
  merchantId: string,
  idempotencyKey: string
) {
  await supabase
    .from('api_idempotency_keys')
    .delete()
    .eq('merchant_id', merchantId)
    .eq('idempotency_key', idempotencyKey);
}
