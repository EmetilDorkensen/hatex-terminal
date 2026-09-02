import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Jere yon sèl tantativ peman anviwònman-an (pending) pou chak "lòd lojik"
 * (fakti / order machann) — pou evite erè duplicate key idx_hp_merchant_order
 * e pou anpeche de peman sou menm fakti/order la.
 *
 * Prensip:
 *  - yon tantativ ki poko ekspire epi ki gen yon sesyon MonCash valab → REUTILIZE
 *  - yon tantativ ki ekspire / echwe → RAFRECHI menm liy hatex_payments la
 *  - okenn liy → ENSERE yon nouvo
 *  - yon liy ki deja 'paid' → jamm manyen li ankò (refize doub peyman)
 */

export type AttemptRow = {
  id: string;
  purpose: string;
  status: string;
  expires_at: string | null;
  moncash_token: string | null;
  gateway_order_id: string | null;
  metadata: Record<string, unknown> | null;
};

const ATTEMPT_SELECT =
  'id, purpose, status, expires_at, moncash_token, gateway_order_id, metadata';

export async function findMerchantAttempt(
  admin: SupabaseClient,
  merchantId: string,
  merchantOrderId: string,
  mode: 'test' | 'live'
): Promise<AttemptRow | null> {
  const { data } = await admin
    .from('hatex_payments')
    .select(ATTEMPT_SELECT)
    .eq('merchant_id', merchantId)
    .eq('merchant_order_id', merchantOrderId)
    .eq('mode', mode)
    .maybeSingle();
  return data ? (data as AttemptRow) : null;
}

export function attemptExpired(row: Pick<AttemptRow, 'expires_at'>, now = Date.now()): boolean {
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() <= now;
}

/** Tantativ ka reutilize si li toujou pending ak sesyon an poko ekspire. */
export function attemptIsReusable(row: AttemptRow, now = Date.now()): boolean {
  return row.status === 'pending' && !attemptExpired(row, now);
}

export type AttemptValues = {
  merchant_amount: number;
  platform_fee: number;
  payout_fee: number;
  client_total: number;
  moncash_token: string | null;
  payer_phone: string | null;
  description: string | null;
  return_url: string | null;
  metadata: Record<string, unknown> | null;
};

/**
 * EnseRe yon nouvo tantativ. Si yon lòt demann kouri menm lè (23505), nou
 * re-chaje liy la epi nou retounen li — se li ki genyen an.
 */
export async function insertAttempt(
  admin: SupabaseClient,
  payload: {
    merchant_id: string;
    merchant_order_id: string;
    gateway_order_id: string;
    purpose: string;
    mode: 'test' | 'live';
    expires_at: string;
  } & AttemptValues
): Promise<{ ok: true; row: AttemptRow } | { ok: false; status: number; message: string }> {
  const { data, error } = await admin
    .from('hatex_payments')
    .insert({ ...payload, status: 'pending' })
    .select(ATTEMPT_SELECT)
    .maybeSingle();

  if (data) return { ok: true, row: data as AttemptRow };

  if (error?.code === '23505') {
    const row = await findMerchantAttempt(
      admin,
      payload.merchant_id,
      payload.merchant_order_id,
      payload.mode
    );
    if (row) return { ok: true, row };
  }

  return {
    ok: false,
    status: 500,
    message: error?.message || 'Pa t kapab sere peman an.',
  };
}

/**
 * Rafrechi yon tantativ ekspire/echwe — menm liy la, nouvo sesyon MonCash.
 * WHERE status='pending' se gad la kont re-ouvri yon peman ki sot peye.
 * Si liy la te vin 'paid' antretan, nou retounen yon erè 409 san touche li.
 */
export async function refreshAttempt(
  admin: SupabaseClient,
  merchantId: string,
  merchantOrderId: string,
  mode: 'test' | 'live',
  row: AttemptRow,
  patch: { gateway_order_id: string; expires_at: string } & AttemptValues
): Promise<{ ok: true; row: AttemptRow } | { ok: false; status: number; message: string }> {
  const { data, error } = await admin
    .from('hatex_payments')
    .update({ ...patch, status: 'pending' })
    .eq('id', row.id)
    .neq('status', 'paid')
    .select(ATTEMPT_SELECT)
    .maybeSingle();

  if (data) return { ok: true, row: data as AttemptRow };

  // Liy la chanje eta antretan (yon konfimasyon te rive). Tcheke kisa li ye.
  const fresh = await findMerchantAttempt(admin, merchantId, merchantOrderId, mode);
  if (fresh?.status === 'paid') {
    return { ok: false, status: 409, message: 'Peman sa a te deja konfime.' };
  }
  if (fresh) return { ok: true, row: fresh };

  return {
    ok: false,
    status: 500,
    message: error?.message || 'Pa t kapab aktyalize peman an.',
  };
}

