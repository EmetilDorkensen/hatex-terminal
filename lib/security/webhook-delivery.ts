import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// DELIVRANS WEBHOOK SEKIRIZE (estil Stripe)
// ============================================================================
// - Siyati: HMAC-SHA256 sou "<timestamp>.<payload>" (header x-hatex-timestamp +
//   x-hatex-signature). Timestamp lan pèmèt machann nan rejte rekèt ki twò
//   ansyen (pwoteksyon kont replay).
// - SSRF: nou refize URL ki pa https, oswa ki pwente sou localhost / rezo
//   prive / metadata cloud — pou anpeche yon machann sèvi ak webhook la pou fè
//   sèvè nou an frape sèvis entèn.
// - Re-eseye: si delivrans lan echwe, nou planifye yon pwochen tantativ
//   (backoff) epi yon cron (/api/developer/webhooks/process-retries) reprann yo.
// ============================================================================

export const WEBHOOK_MAX_ATTEMPTS = 6;
// Reta (an minit) anvan chak tantativ. Endèks = attempt_count aktyèl la.
const RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 360, 1440];

export const ALLOWED_WEBHOOK_EVENTS = ['payment.success', 'ping'] as const;
export type WebhookEventType = (typeof ALLOWED_WEBHOOK_EVENTS)[number];

/**
 * Verifye si yon URL webhook an sekirite (anti-SSRF). Egzije HTTPS epi refize
 * lyen lokal / adrès IP prive / metadata cloud.
 */
export function isSafeWebhookUrl(rawUrl: string): { safe: boolean; reason?: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: 'URL pa valab.' };
  }

  if (url.protocol !== 'https:') {
    return { safe: false, reason: 'URL webhook la dwe an HTTPS.' };
  }

  const host = url.hostname.toLowerCase();

  // Non lokal evidan
  if (host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0' || host === '::1' || host === '[::1]') {
    return { safe: false, reason: 'URL lokal pa otorize.' };
  }

  // Adrès IPv4 prive / lyen lokal / loopback
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    const isPrivate =
      a === 10 ||
      a === 127 ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 169 && b === 254) || // link-local (metadata cloud 169.254.169.254)
      a === 0;
    if (isPrivate) {
      return { safe: false, reason: 'Adrès IP prive/lokal pa otorize.' };
    }
  }

  return { safe: true };
}

export function generateWebhookSecret(): string {
  return 'whsec_' + crypto.randomBytes(24).toString('hex');
}

function signPayload(secret: string, timestamp: string, payloadString: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${payloadString}`).digest('hex');
}

function nextRetryAt(attemptCount: number): string | null {
  if (attemptCount >= WEBHOOK_MAX_ATTEMPTS) return null;
  const minutes = RETRY_BACKOFF_MINUTES[Math.min(attemptCount, RETRY_BACKOFF_MINUTES.length - 1)];
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

type EndpointRow = {
  id: string;
  merchant_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
};

/**
 * Voye yon sèl evènman bay yon sèl pwen. Anrejistre rezilta a nan
 * `developer_webhook_deliveries`. Retounen si l reyisi.
 */
async function sendToEndpoint(
  supabase: SupabaseClient,
  endpoint: EndpointRow,
  eventType: string,
  eventData: Record<string, unknown>,
  deliveryId?: string,
  attemptCount = 1
): Promise<boolean> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = {
    id: deliveryId || crypto.randomUUID(),
    event: eventType,
    created: Number(timestamp),
    data: eventData,
  };
  const payloadString = JSON.stringify(payload);
  const signature = signPayload(endpoint.secret, timestamp, payloadString);

  let responseStatus: number | null = null;
  let success = false;

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hatex-signature': signature,
        'x-hatex-timestamp': timestamp,
        'x-hatex-event': eventType,
      },
      body: payloadString,
      signal: AbortSignal.timeout(5000),
    });
    responseStatus = res.status;
    success = res.ok;
  } catch {
    success = false;
  }

  const retryAt = success ? null : nextRetryAt(attemptCount);

  if (deliveryId) {
    // Mizajou yon tantativ ki egziste deja (chemen re-eseye).
    await supabase
      .from('developer_webhook_deliveries')
      .update({
        response_status: responseStatus,
        success,
        attempt_count: attemptCount,
        next_retry_at: retryAt,
        delivered_at: success ? new Date().toISOString() : null,
      })
      .eq('id', deliveryId);
  } else {
    // Premye tantativ — kreye antre a.
    await supabase.from('developer_webhook_deliveries').insert({
      endpoint_id: endpoint.id,
      merchant_id: endpoint.merchant_id,
      event_type: eventType,
      payload,
      response_status: responseStatus,
      success,
      attempt_count: attemptCount,
      next_retry_at: retryAt,
      delivered_at: success ? new Date().toISOString() : null,
    });
  }

  return success;
}

/**
 * Voye yon evènman bay TOUT pwen webhook aktif yon machann ki abòne a
 * `eventType`. Pa janm lanse yon eksepsyon (yon webhook ki echwe pa dwe kraze
 * peman an) — echèk yo anrejistre pou re-eseye pita.
 */
export async function deliverWebhookEvent(
  supabase: SupabaseClient,
  merchantId: string,
  eventType: string,
  eventData: Record<string, unknown>
): Promise<void> {
  try {
    const { data: endpoints } = await supabase
      .from('developer_webhook_endpoints')
      .select('id, merchant_id, url, secret, events, is_active')
      .eq('merchant_id', merchantId)
      .eq('is_active', true);

    if (!endpoints || endpoints.length === 0) return;

    await Promise.all(
      (endpoints as EndpointRow[])
        .filter((ep) => Array.isArray(ep.events) && ep.events.includes(eventType))
        .map((ep) => sendToEndpoint(supabase, ep, eventType, eventData))
    );
  } catch (err) {
    console.error('[WEBHOOK DELIVERY ERROR]', err);
  }
}

/**
 * Voye yon evènman tès imedyat bay yon sèl pwen (bouton "Voye Tès" nan
 * tablodbò a). Retounen estati repons lan.
 */
export async function sendTestWebhook(
  supabase: SupabaseClient,
  endpoint: EndpointRow
): Promise<{ success: boolean; response_status: number | null }> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = {
    id: crypto.randomUUID(),
    event: 'ping',
    created: Number(timestamp),
    data: { message: 'Tès webhook HatexCard reyisi.' },
  };
  const payloadString = JSON.stringify(payload);
  const signature = signPayload(endpoint.secret, timestamp, payloadString);

  let responseStatus: number | null = null;
  let success = false;
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hatex-signature': signature,
        'x-hatex-timestamp': timestamp,
        'x-hatex-event': 'ping',
      },
      body: payloadString,
      signal: AbortSignal.timeout(5000),
    });
    responseStatus = res.status;
    success = res.ok;
  } catch {
    success = false;
  }

  await supabase.from('developer_webhook_deliveries').insert({
    endpoint_id: endpoint.id,
    merchant_id: endpoint.merchant_id,
    event_type: 'ping',
    payload,
    response_status: responseStatus,
    success,
    attempt_count: 1,
    next_retry_at: null,
    delivered_at: success ? new Date().toISOString() : null,
  });

  return { success, response_status: responseStatus };
}

/**
 * Reprann tout delivrans ki echwe epi ki prè pou re-eseye (itilize pa cron).
 */
export async function processWebhookRetries(supabase: SupabaseClient): Promise<number> {
  const { data: pending } = await supabase
    .from('developer_webhook_deliveries')
    .select('id, endpoint_id, merchant_id, event_type, payload, attempt_count, developer_webhook_endpoints(id, merchant_id, url, secret, events, is_active)')
    .eq('success', false)
    .not('next_retry_at', 'is', null)
    .lte('next_retry_at', new Date().toISOString())
    .lt('attempt_count', WEBHOOK_MAX_ATTEMPTS)
    .limit(50);

  if (!pending || pending.length === 0) return 0;

  let processed = 0;
  for (const row of pending as any[]) {
    const ep = row.developer_webhook_endpoints;
    if (!ep || !ep.is_active) {
      // Pwen an efase/inaktif — sispann re-eseye.
      await supabase.from('developer_webhook_deliveries').update({ next_retry_at: null }).eq('id', row.id);
      continue;
    }
    // Re-voye MENM payload la (kenbe menm event id pou idempotency bò kote machann nan).
    const eventData = row.payload?.data || {};
    await sendToEndpoint(supabase, ep as EndpointRow, row.event_type, eventData, row.id, (row.attempt_count || 1) + 1);
    processed += 1;
  }

  return processed;
}
