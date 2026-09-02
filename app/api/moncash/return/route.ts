import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { settleMonCashPayment } from '@/lib/moncash/settle';
import { isPreviewOrLocalUrl, publicSiteUrl } from '@/lib/urls/public';

/**
 * RETURN URL — kote MonCash voye NAVIGATÈ kliyan an tounen apre peman.
 *
 * Nou verifye peman an sou sèvè (menm jan ak alert), epi nou redirije kliyan an
 * sou paj rezilta a — oswa sou return_url machann nan si li te bay youn.
 *
 * Konfigire nan pòtay MonCash:  https://hatexcard.com/api/moncash/return
 */

const SITE_URL = publicSiteUrl();

const ORDER_KEYS = ['orderId', 'order_id', 'reference', 'ref'];
const TX_KEYS = ['transactionId', 'transaction_id', 'transactionID', 'txId'];

function pick(params: URLSearchParams, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = params.get(key);
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

/** Sèlman URL http(s) — pa janm redirije sou javascript: oswa lòt konplo. */
function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Kote nou voye navigatè a lè MonCash pa t bay okenn return_url machann.
 * - Pwodwi / peman machann (API, plugin) → paj siksè inifye /success (DB vérifye).
 * - Lòt yo (frè KYC, plan…) → paj rezilta jenerik /pay/result.
 */
function resultRedirect(
  status: 'success' | 'failed' | 'unknown',
  paymentId?: string,
  purpose?: string | null
) {
  const params = new URLSearchParams({ status });
  if (paymentId) params.set('payment', paymentId);
  const base =
    purpose === 'merchant' || purpose === 'product'
      ? `${SITE_URL}/success`
      : `${SITE_URL}/pay/result`;
  return NextResponse.redirect(`${base}?${params}`);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const gatewayOrderId = pick(searchParams, ORDER_KEYS);
  const transactionId = pick(searchParams, TX_KEYS);

  if (!gatewayOrderId && !transactionId) {
    return resultRedirect('unknown');
  }

  const admin = createSupabaseAdminClient();

  // Chèche peman an ANVAN nou regle l: konsa menm si règleman an echwe, nou
  // konnen ki paj rezilta ki bon pou moun sa a (frè KYC vs peman machann).
  let query = admin
    .from('hatex_payments')
    .select('id, purpose, return_url, merchant_order_id');
  query = gatewayOrderId
    ? query.eq('gateway_order_id', gatewayOrderId)
    : query.eq('moncash_transaction_id', transactionId!);

  const { data: payment } = await query.maybeSingle();

  const destination = (status: 'success' | 'failed') => {
    const returnUrl = safeExternalUrl(payment?.return_url);
    if (returnUrl && !isPreviewOrLocalUrl(returnUrl)) {
      const target = new URL(returnUrl);
      target.searchParams.set('status', status);
      // Referans entèn frè KYC pa gen valè pou moun nan — pa ekspoze l
      if (payment?.purpose !== 'kyc_fee' && payment?.merchant_order_id) {
        target.searchParams.set('order_id', String(payment.merchant_order_id));
      }
      return NextResponse.redirect(target.toString());
    }
    return resultRedirect(status, payment?.id, payment?.purpose);
  };

  const result = await settleMonCashPayment(admin, {
    gatewayOrderId,
    transactionId,
  } as Parameters<typeof settleMonCashPayment>[1]);

  if (!result.ok) {
    console.error('[moncash/return] règleman echwe:', result.message);
    return destination('failed');
  }

  return destination('success');
}

export async function POST(request: Request) {
  return GET(request);
}
