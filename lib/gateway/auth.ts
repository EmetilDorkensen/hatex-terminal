import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayMode } from '@/lib/moncash/config';
import { lookupGatewayApiKey, touchGatewayApiKey } from './api-keys';

/**
 * Otantifikasyon demann API machann yo.
 *
 * Règ enpòtan: yon kle `test` mache menm si KYC machann nan poko apwouve — se
 * konsa devlopè ka entegre pandan y ap tann. Yon kle `live` mande yon kont
 * `active`, paske se vre lajan.
 */

export type MerchantAccount = {
  user_id: string;
  account_type: 'individual' | 'business';
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  payout_provider: string;
  payout_phone: string | null;
  per_tx_limit_htg: number | null;
  monthly_limit_htg: number | null;
  auto_payout_enabled: boolean;
};

const ACCOUNT_SELECT =
  'user_id, account_type, status, payout_provider, payout_phone, per_tx_limit_htg, monthly_limit_htg, auto_payout_enabled';

export type GatewayAuth = {
  merchantId: string;
  apiKeyId: string;
  mode: GatewayMode;
  account: MerchantAccount;
};

export type GatewayAuthFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type GatewayAuthResult = ({ ok: true } & GatewayAuth) | GatewayAuthFailure;

/** Rale kle a nan header `Authorization: Bearer ...` oswa `X-Api-Key`. */
export function extractApiKey(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (auth) {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (match) return match[1].trim();
  }
  const header = request.headers.get('x-api-key');
  return header ? header.trim() : null;
}

export async function authenticateGatewayRequest(
  admin: SupabaseClient,
  request: Request
): Promise<GatewayAuthResult> {
  const token = extractApiKey(request);

  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'missing_api_key',
      message: 'Kle API manke. Voye l nan header: Authorization: Bearer <kle>.',
    };
  }

  const keyRow = await lookupGatewayApiKey(admin, token);
  if (!keyRow) {
    return {
      ok: false,
      status: 401,
      code: 'invalid_api_key',
      message: 'Kle API pa valab oswa li revoke.',
    };
  }

  const { data: account } = await admin
    .from('hatex_merchant_accounts')
    .select(ACCOUNT_SELECT)
    .eq('user_id', keyRow.merchant_id)
    .maybeSingle();

  if (!account) {
    return {
      ok: false,
      status: 403,
      code: 'no_merchant_account',
      message: 'Kont machann nan pa konfigire. Konplete anrejistreman an sou Dashboard la.',
    };
  }

  const acct = account as MerchantAccount;

  if (acct.status === 'suspended' || acct.status === 'rejected') {
    return {
      ok: false,
      status: 403,
      code: 'account_inactive',
      message:
        acct.status === 'suspended'
          ? 'Kont sa a sispann. Kontakte sipò HatexCard.'
          : 'Kont sa a refize. Ou ka voye yon nouvo dosye KYC.',
    };
  }

  // Vre lajan: kont aktif (plan gratis ka resevwa san KYC)
  if (keyRow.mode === 'live' && acct.status !== 'active') {
    return {
      ok: false,
      status: 403,
      code: 'account_inactive',
      message:
        acct.status === 'pending'
          ? 'Kont ou poko aktif. Chwazi yon plan sou /plan.'
          : 'Kont sa a pa aktif pou peman live.',
    };
  }

  if (keyRow.mode === 'live' && !acct.payout_phone) {
    return {
      ok: false,
      status: 409,
      code: 'payout_not_configured',
      message: 'Mete yon nimewo MonCash pou payout anvan ou aksepte peman live.',
    };
  }

  void touchGatewayApiKey(admin, keyRow.id);

  return {
    ok: true,
    merchantId: keyRow.merchant_id,
    apiKeyId: keyRow.id,
    mode: keyRow.mode,
    account: acct,
  };
}
