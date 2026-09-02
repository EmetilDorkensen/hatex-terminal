
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolvè lyen fakti piblik.
 *
 * Paramèt route /checkout-invoice/[ref] ak query params ka refere a:
 *  - yon share_token opak (32 hex) → nou mande DB
 *  - yon ansyen id UUID (lyen legacy ki te deja voye) → id la se ref la
 *
 * Tout lyen nouvo dwe itilize share_token — id entèn pa janm ekspoze.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[0-9a-f]{32}$/i;

/** Chache id fakti a soti nan yon ref piblik (share_token oswa uuid legacy). */
export async function resolveInvoiceIdByRef(
  admin: SupabaseClient,
  ref: string | null | undefined
): Promise<string | null> {
  const r = String(ref || '').trim().slice(0, 300);
  if (!r) return null;

  if (TOKEN_RE.test(r)) {
    const { data } = await admin
      .from('invoices')
      .select('id')
      .eq('share_token', r)
      .maybeSingle();
    return data?.id ?? null;
  }

  if (UUID_RE.test(r)) return r;
  return null;
}

/** Kolòn ki ka ekspoze piblikman sou yon fakti — san id DB / owner_id. */
export type PublicInvoiceView = {
  ref: string;
  amount: number;
  currency: string;
  client_email: string | null;
  description: string | null;
  status: string;
  has_payout: boolean;
  created_at: string | null;
};

/**
 * Chaje yon fakti by id ak share_token si kolòn nan egziste deja.
 * PGRST204 = kolòn nan poko nan DB (migrasyon poko aplike) → nou retounen
 * san li (legacy). Konsa depiman kòd la pa kase anvan migrasyon an.
 */
export async function fetchInvoiceById(
  admin: SupabaseClient,
  invoiceId: string,
  columns: readonly string[],
  extraEq?: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const run = async (sel: string) => {
    let q = admin.from('invoices').select(sel).eq('id', invoiceId);
    if (extraEq) {
      for (const [k, v] of Object.entries(extraEq)) q = q.eq(k, v);
    }
    return q.maybeSingle();
  };

  let res = await run([...columns, 'share_token'].join(', '));
  if (res.error && (res.error as { code?: string })?.code === 'PGRST204') {
    res = await run(columns.join(', '));
  }
  if (res.error || !res.data) return null;
  return res.data as unknown as Record<string, unknown>;
}

export function toPublicInvoiceView(
  invoice: {
    id: string;
    share_token?: string | null;
    amount: number;
    currency: string | null;
    client_email: string | null;
    description: string | null;
    status: string;
    payout_account_id: string | null;
    created_at?: string | null;
  }
): PublicInvoiceView {
  return {
    ref: invoice.share_token || invoice.id,
    amount: Number(invoice.amount) || 0,
    currency: invoice.currency === 'USD' ? 'USD' : 'HTG',
    client_email: invoice.client_email,
    description: invoice.description,
    status: invoice.status,
    has_payout: Boolean(invoice.payout_account_id),
    created_at: invoice.created_at ?? null,
  };
}
