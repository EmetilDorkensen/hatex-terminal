import 'server-only';

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashApiKey } from '@/lib/security/api-key';
import type { GatewayMode } from '@/lib/moncash/config';
import { maskGatewayApiKey } from '@/lib/gateway/api-key-display';

export { maskGatewayApiKey };

/**
 * Kle API pasrèl v2 (SÈVÈ SÈLMAN).
 *
 * Chak machann gen yon kle `test` ak yon kle `live`. Kle a montre yon sèl fwa
 * lè li kreye — nou kenbe yon HMAC sèlman, donk menm si baz done a fwite,
 * pèsonn pa ka rekonstwi kle a.
 */

const PREFIXES: Record<GatewayMode, string> = {
  test: 'hx_sk_test_',
  live: 'hx_sk_live_',
};

/** Konbyen karaktè nou montre nan istorik (prefiks + yon ti moso antropi). */
const DISPLAY_ENTROPY_CHARS = 8;

export type GeneratedApiKey = {
  /** Kle an klè — montre yon sèl fwa, pa janm sere. */
  token: string;
  keyHash: string;
  keyPrefix: string;
  mode: GatewayMode;
};

export function generateGatewayApiKey(mode: GatewayMode): GeneratedApiKey {
  const token = PREFIXES[mode] + crypto.randomBytes(24).toString('hex');
  return {
    token,
    keyHash: hashApiKey(token),
    keyPrefix: token.slice(0, PREFIXES[mode].length + DISPLAY_ENTROPY_CHARS),
    mode,
  };
}

/** Ki mòd yon kle ye, dapre prefiks li. Null si li pa yon kle pasrèl v2. */
export function gatewayKeyMode(token: string): GatewayMode | null {
  const trimmed = token.trim();
  if (trimmed.startsWith(PREFIXES.live)) return 'live';
  if (trimmed.startsWith(PREFIXES.test)) return 'test';
  return null;
}

export type GatewayApiKeyRow = {
  id: string;
  merchant_id: string;
  mode: GatewayMode;
  is_active: boolean;
  revoked_at: string | null;
};

/**
 * Jwenn kle a nan baz done a. Rechèch fèt sou hash la sèlman.
 */
export async function lookupGatewayApiKey(
  admin: SupabaseClient,
  token: string
): Promise<GatewayApiKeyRow | null> {
  const mode = gatewayKeyMode(token);
  if (!mode) return null;

  const { data } = await admin
    .from('hatex_api_keys')
    .select('id, merchant_id, mode, is_active, revoked_at')
    .eq('key_hash', hashApiKey(token.trim()))
    .maybeSingle();

  if (!data) return null;
  if (data.mode !== mode) return null;
  if (!data.is_active || data.revoked_at) return null;

  return data as GatewayApiKeyRow;
}

/** Make kle a kòm sèvi. Pa bloke repons lan si sa echwe. */
export async function touchGatewayApiKey(
  admin: SupabaseClient,
  apiKeyId: string
): Promise<void> {
  try {
    await admin
      .from('hatex_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyId);
  } catch {
    /* pa enpòtan ase pou kraze yon peman */
  }
}

/**
 * Kreye (oswa woule) kle a pou yon mòd. Ansyen kle a revoke nan menm operasyon.
 * Retounen kle an klè — se sèl fwa li disponib.
 */
export async function rotateGatewayApiKey(
  admin: SupabaseClient,
  merchantId: string,
  mode: GatewayMode,
  label?: string
): Promise<{ ok: true; key: GeneratedApiKey } | { ok: false; message: string }> {
  const now = new Date().toISOString();

  const { error: revokeErr } = await admin
    .from('hatex_api_keys')
    .update({ is_active: false, revoked_at: now })
    .eq('merchant_id', merchantId)
    .eq('mode', mode)
    .eq('is_active', true);

  if (revokeErr) return { ok: false, message: revokeErr.message };

  const generated = generateGatewayApiKey(mode);

  const { error: insertErr } = await admin.from('hatex_api_keys').insert({
    merchant_id: merchantId,
    mode,
    key_hash: generated.keyHash,
    key_prefix: generated.keyPrefix,
    label: label?.slice(0, 80) || null,
  });

  if (insertErr) return { ok: false, message: insertErr.message };

  return { ok: true, key: generated };
}
