/**
 * Mask kle pasrèl v2 — UI-safe, san crypto / sekrè.
 */

const PREFIXES = {
  test: 'hx_sk_test_',
  live: 'hx_sk_live_',
} as const;

export function maskGatewayApiKey(keyPrefix: string | null | undefined): string {
  if (!keyPrefix) return `${PREFIXES.test}${'•'.repeat(16)}`;
  return `${keyPrefix}${'•'.repeat(16)}`;
}
