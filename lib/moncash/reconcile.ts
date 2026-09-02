import type { SupabaseClient } from '@supabase/supabase-js';
import { settleMonCashPayment, type SettleInput } from './settle';

/**
 * Re-konsilyasyon peman pou machann nan (moun ki resevwa kòb la).
 *
 * Prensip: TOUT konfimasyon fèt nan baz done a, jamè nan navigatè a.
 *  - Nou lis peman ki toujou 'pending' nan hatex_payments (DB = verite).
 *  - Pou chak youn, settleMonCashPayment rele MonCash tèt li (RetrieveOrder /
 *    RetrieveTransaction) epi sèlman si MonCash konfime, li make 'paid' nan DB
 *    epi li fini fè efè yo (fakti peye, lavant konte, payout kreyasyon).
 *
 * Se sèlman peman kote machann nan RESEVWA lajan (invoice / product / merchant)
 * ki antre nan resync sa a — pa frè KYC ni abònman ke moun nan peye.
 */

export const RECEIVE_PURPOSES = ['invoice', 'product', 'merchant'] as const;
export type ReceivePurpose = (typeof RECEIVE_PURPOSES)[number];

export type MerchantPaymentRow = {
  id: string;
  merchant_id: string;
  purpose: string;
  status: string;
  mode: 'test' | 'live';
  merchant_amount: number | null;
  platform_fee: number | null;
  client_total: number | null;
  merchant_order_id: string | null;
  gateway_order_id: string;
  moncash_transaction_id: string | null;
  description: string | null;
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
};

export const MERCHANT_PAYMENT_SELECT =
  'id, merchant_id, purpose, status, mode, merchant_amount, platform_fee, client_total, merchant_order_id, gateway_order_id, moncash_transaction_id, description, created_at, paid_at, expires_at';

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

/** Kantite maksimòm re-eseye sou yon re-konsilyasyon otomatik (pou pa debòde API MonCash). */
export const MAX_AUTO_RESYNC = 10;

/** Kantite total pou paj la (lis DB). */
export const MAX_LIST_ROWS = 50;

export function isReceivePurpose(purpose: string): boolean {
  return (RECEIVE_PURPOSES as readonly string[]).includes(purpose);
}

/** Lis peman kote machann nan resevwa lajan — DB sèlman. */
export async function fetchMerchantIncomePayments(
  admin: SupabaseClient,
  merchantId: string,
  opts: { status?: string; limit?: number } = {}
): Promise<MerchantPaymentRow[]> {
  const limit = Math.min(MAX_LIST_ROWS, Math.max(1, opts.limit || MAX_LIST_ROWS));

  let query = admin
    .from('hatex_payments')
    .select(MERCHANT_PAYMENT_SELECT)
    .eq('merchant_id', merchantId)
    .in('purpose', [...RECEIVE_PURPOSES])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts.status) query = query.eq('status', opts.status);

  const { data } = await query;
  return (data || []) as MerchantPaymentRow[];
}

/** Tantativ pending ki ka verifye ak MonCash (DB sèlman, pa pi gran pase 14 jou). */
async function pendingCandidates(
  admin: SupabaseClient,
  merchantId: string,
  paymentId?: string
): Promise<MerchantPaymentRow[]> {
  let query = admin
    .from('hatex_payments')
    .select(MERCHANT_PAYMENT_SELECT)
    .eq('merchant_id', merchantId)
    .in('purpose', [...RECEIVE_PURPOSES])
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - FOURTEEN_DAYS).toISOString())
    .order('created_at', { ascending: true })
    .limit(MAX_AUTO_RESYNC);

  if (paymentId) query = query.eq('id', paymentId);

  const { data } = await query;
  return (data || []) as MerchantPaymentRow[];
}

export type ResyncDetail = {
  payment_id: string;
  purpose: string;
  ok: boolean;
  already_paid: boolean;
  message: string;
};

export type ResyncResult = {
  ok: boolean;
  checked: number;
  paid: number;
  failed: number;
  details: ResyncDetail[];
  message?: string;
};


/**
 * Verifye ak MonCash epi regle peman an atant nan DB.
 *
 * - San `paymentId` → tout peman 'pending' kote machann nan resevwa lajan.
 * - Avèk `paymentId` → yon sèl peman (sa a dwe pou machann sa a).
 *
 * Okenn kantite pa chanje si MonCash pa konfime — nou pa janm fè konfyans
 * demandè a, sèlman repons MonCash lan (verifye sou sèvè).
 */
export async function resyncMerchantPayments(
  admin: SupabaseClient,
  merchantId: string,
  paymentId?: string
): Promise<ResyncResult> {
  let candidates: MerchantPaymentRow[];

  if (paymentId) {
    const rows = await pendingCandidates(admin, merchantId, paymentId);
    if (rows.length === 0) {
      const { data: anyRow } = await admin
        .from('hatex_payments')
        .select('id, purpose, status')
        .eq('id', paymentId)
        .eq('merchant_id', merchantId)
        .maybeSingle();

      if (anyRow?.status === 'paid') {
        return {
          ok: true,
          checked: 0,
          paid: 0,
          failed: 0,
          details: [],
          message: 'Peman sa a te deja peye nan baz done a.',
        };
      }
      return {
        ok: false,
        checked: 0,
        paid: 0,
        failed: 0,
        details: [],
        message: anyRow
          ? 'Peman sa a pa ka verifye (li pa pou resevwa kòb).'
          : 'Peman sa a pa jwenn pou kont ou.',
      };
    }
    candidates = rows;
  } else {
    candidates = await pendingCandidates(admin, merchantId);
  }

  if (candidates.length === 0) {
    return { ok: true, checked: 0, paid: 0, failed: 0, details: [] };
  }

  let paid = 0;
  const details: ResyncDetail[] = [];

  for (const row of candidates) {
    try {
      const result = await settleMonCashPayment(admin, {
        gatewayOrderId: row.gateway_order_id,
        transactionId: row.moncash_transaction_id || undefined,
      } as SettleInput);

      if (result.ok) {
        paid += 1;
        details.push({
          payment_id: row.id,
          purpose: row.purpose,
          ok: true,
          already_paid: result.alreadySettled,
          message: 'Konfime peye sou MonCash.',
        });
      } else {
        details.push({
          payment_id: row.id,
          purpose: row.purpose,
          ok: false,
          already_paid: false,
          message: result.message,
        });
      }
    } catch (err) {
      details.push({
        payment_id: row.id,
        purpose: row.purpose,
        ok: false,
        already_paid: false,
        message: err instanceof Error ? err.message : 'Erè inatann.',
      });
    }
  }

  const failed = candidates.length - paid;
  return { ok: true, checked: candidates.length, paid, failed, details };
}

