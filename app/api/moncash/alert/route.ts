import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { settleMonCashPayment } from '@/lib/moncash/settle';
import { isPreviewOrLocalUrl, publicSiteUrl } from '@/lib/urls/public';

/**
 * ALERT URL — MonCash rele wout sa a sèvè-a-sèvè lè yon peman fèt.
 *
 * Nou pa fè konfyans kontni an: nou pran sèlman referans yo epi nou rele
 * MonCash tèt li pou verifye peman an. Konsa menm si yon moun voye yon fo
 * notifikasyon, li pa ka make yon peman kòm peye.
 *
 * Konfigire nan pòtay MonCash: Alert URL = https://hatexcard.com/api/moncash/alert
 * (oswa {NEXT_PUBLIC_SITE_URL}/api/moncash/alert)
 */

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

const ORDER_KEYS = ['orderId', 'order_id', 'reference', 'ref'];
const TX_KEYS = ['transactionId', 'transaction_id', 'transactionID', 'txId'];
const SITE_URL = publicSiteUrl();

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

function wantsBrowserRedirect(request: Request): boolean {
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html') || request.method === 'GET';
}

async function readParams(request: Request): Promise<Record<string, unknown>> {
  const url = new URL(request.url);
  const fromQuery: Record<string, unknown> = Object.fromEntries(url.searchParams.entries());

  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (body && typeof body === 'object') {
        return { ...fromQuery, ...(body as Record<string, unknown>) };
      }
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const form = await request.formData();
      return { ...fromQuery, ...Object.fromEntries(form.entries()) };
    }
  } catch {
    // Kite fromQuery a
  }

  return fromQuery;
}

async function handle(request: Request) {
  const params = await readParams(request);

  const gatewayOrderId = pickString(params, ORDER_KEYS);
  const transactionId = pickString(params, TX_KEYS);

  if (!gatewayOrderId && !transactionId) {
    // Retounen 200 pou MonCash pa re-eseye san rezon
    return NextResponse.json(
      { success: false, message: 'Pa gen orderId ni transactionId.' },
      { status: 200 }
    );
  }

  const admin = createSupabaseAdminClient();

  let query = admin
    .from('hatex_payments')
    .select('id, purpose, return_url, merchant_order_id');
  query = gatewayOrderId
    ? query.eq('gateway_order_id', gatewayOrderId)
    : query.eq('moncash_transaction_id', transactionId!);
  const { data: payment } = await query.maybeSingle();

  const browser = wantsBrowserRedirect(request);
  const destination = (status: 'success' | 'failed') => {
    if (!browser) return null;
    const returnUrl = safeExternalUrl(payment?.return_url);
    if (returnUrl && !isPreviewOrLocalUrl(returnUrl)) {
      const target = new URL(returnUrl);
      target.searchParams.set('status', status);
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

  await admin.from('hatex_moncash_alerts').insert({
    gateway_order_id: gatewayOrderId || null,
    transaction_id: transactionId || null,
    payload: params,
    settled: result.ok,
    settle_message: result.ok ? 'ok' : result.message,
  }).then(
    () => undefined,
    (err: unknown) => console.error('[moncash/alert] pa t kapab sere jounal:', err)
  );

  if (!result.ok) {
    console.error('[moncash/alert] règleman echwe:', result.message, {
      gatewayOrderId,
      transactionId,
    });
    const redirect = destination('failed');
    if (redirect) return redirect;
    return NextResponse.json({ success: false, message: result.message }, { status: 200 });
  }

  const redirect = destination('success');
  if (redirect) return redirect;

  return NextResponse.json({
    success: true,
    payment_id: result.paymentId,
    already_settled: result.alreadySettled,
  });
}

export async function POST(request: Request) {
  return handle(request);
}

// Kèk konfigirasyon MonCash rele Alert URL an GET — sipòte toude
export async function GET(request: Request) {
  return handle(request);
}
