import { getMonCashToken } from './client';
import type { MonCashConfig } from './config';

/**
 * MonCash "USSD push" — demann konfimasyon dirèk sou telefòn kliyan an.
 *
 * RAPÈL IMPORTAN:
 * API piblik MonCash biznis la (CreatePayment) pa ka voye USSD dirèk sou yon
 * nimewo — paj hosted MonCash la (Payment/Redirect) sèlman ka deklannche USSD a.
 * Yon "push" dirèk egzije yon API espesyal Digicel (Direct Debit / USSD Push)
 * sou kont biznis la. Kòd sa a se ESTRIKTI a ki prete: lè Digicel bay
 * espesifikasyon an, n ap ajiste kontra anba a (payload + validasyon repons)
 * epi mete varyab anviwònman `MONCASH_USSD_PUSH_URL`.
 *
 * Jouk lè sa a, tout pasrèl yo itilize mòd `hosted` (paj MonCash) kòm fallback —
 * sa vle di kliyan an ap resevwa USSD a toujou, men apre li pase sou paj MonCash.
 */

export type MonCashFlowMode = 'auto' | 'redirect' | 'ussd';
export type MonCashCheckoutMode = 'hosted' | 'ussd';

/** Pliyaj flow yon itilizatè/API mande a. Default: 'auto'. */
export function parseMonCashFlow(raw: unknown, fallback: MonCashFlowMode = 'auto'): MonCashFlowMode {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'redirect' || v === 'ussd') return v as MonCashFlowMode;
  return fallback === 'redirect' || fallback === 'ussd' ? fallback : 'auto';
}

/**
 * Netwaye yon nimewo MonCash.
 * Nimewo MonCash Ayiti fòm: 509 + 8 chif (11 total). Nou aksepte tou nimewo
 * ki pa gen 509 pou sandbox tès, si li gen 8–15 chif.
 */
export function normalizeMonCashPhone(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** Verite: 509 + 8 chif (nimewo MonCash reyèl Ayiti). */
export function isValidHaitiMonCashPhone(phone: string | null): boolean {
  return typeof phone === 'string' && /^509\d{8}$/.test(phone);
}


export type UssdAttempt =
  | { ok: true; reference: string; raw: unknown }
  | {
      ok: false;
      code: 'skipped' | 'not_configured' | 'invalid_phone' | 'provider';
      message: string;
      raw?: unknown;
    };

const TIMEOUT_MS = 20000;

/**
 * Eseye voye yon USSD dirèk sou telefòn kliyan an.
 *
 * - `flow: 'redirect'`  → pa janm eseye (skipped).
 * - `flow: 'ussd'`      → egzije nimewo + API konfigire; si pa bon, retounen erè.
 * - `flow: 'auto'`      → eseye si nimewo + API konfigire; sinon skipped (hosted).
 *
 * KONTRA AK DIGICEL (POU KONFIRME LÈ YO BAY ESPESIFIKASYON AN):
 *   POST {url} Authorization: Bearer <token OAuth biznis la>
 *   JSON  { phone, amount, orderId, reference, description }
 *   Repons aksepte si 2xx epi repons lan pa di `ok:false` / `error`.
 *   `reference` nan repons lan (transaction_id / reference / orderId) se referans
 *   pou reteyabl la — konsa Alert URL ak RetrieveOrderPayment ka regle peman an.
 */
export async function attemptMonCashUssdPush(opts: {
  cfg: MonCashConfig;
  flow: MonCashFlowMode;
  phone: unknown;
  amount: number;
  orderId: string;
  description?: string | null;
  reference?: string | null;
}): Promise<UssdAttempt> {
  if (opts.flow === 'redirect') {
    return { ok: false, code: 'skipped', message: 'Flow redirect — pa gen USSD.' };
  }

  const phone = normalizeMonCashPhone(opts.phone);
  if (!phone || !isValidHaitiMonCashPhone(phone)) {
    if (opts.flow === 'ussd') {
      return {
        ok: false,
        code: 'invalid_phone',
        message: 'Antre yon nimewo MonCash valab (fòm 509xxxxxxxx).',
      };
    }
    return { ok: false, code: 'skipped', message: 'Pa gen nimewo valab — hosted.' };
  }

  const url = process.env.MONCASH_USSD_PUSH_URL?.trim();
  if (!url) {
    if (opts.flow === 'ussd') {
      return {
        ok: false,
        code: 'not_configured',
        message:
          'Mòd USSD dirèk poko aktif sou kont MonCash la. Mete MONCASH_USSD_PUSH_URL apre Digicel bay API a, oswa itilize flow default la.',
      };
    }
    return { ok: false, code: 'skipped', message: 'USSD push poko konfigire — hosted.' };
  }

  const token = await getMonCashToken(opts.cfg);
  if (!token.ok) {
    return { ok: false, code: 'provider', message: token.message };
  }

  const amount = Math.round(Number(opts.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, code: 'invalid_phone', message: 'Montan USSD pa valab.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.data}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        phone,
        amount,
        orderId: String(opts.orderId).slice(0, 64),
        reference: String(opts.reference || opts.orderId).slice(0, 64),
        description: opts.description ? String(opts.description).slice(0, 120) : null,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch {
    return { ok: false, code: 'provider', message: 'Pa ka jwenn MonCash (USSD). Eseye ankò.' };
  } finally {
    clearTimeout(timer);
  }

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok || json?.ok === false || json?.error) {
    const detail = json?.message ?? json?.error;
    return {
      ok: false,
      code: 'provider',
      message: `MonCash refize demann USSD a${detail ? `: ${String(detail)}` : ''}.`,
      raw: json,
    };
  }

  const reference =
    typeof json?.transaction_id === 'string' && json.transaction_id
      ? json.transaction_id
      : typeof json?.reference === 'string' && json.reference
        ? json.reference
        : typeof json?.orderId === 'string' && json.orderId
          ? json.orderId
          : String(opts.orderId);

  return { ok: true, reference, raw: json };
}

/** API USSD dirèk la konfigire? (varyab anviwònman sou Vercel/.env.local) */
export function isUssdPushConfigured(): boolean {
  return Boolean(process.env.MONCASH_USSD_PUSH_URL?.trim());
}

/**
 * Mete flow la nan metadata yon peman (pou swiv/verifye apre).
 * `ussd_reference` rete nan metadata a si Digicel te retounen yon referans.
 */
export function flowMetadata(
  flow: MonCashFlowMode,
  ussdReference?: string | null,
  extra?: Record<string, unknown> | null
): Record<string, unknown> | null {
  const meta: Record<string, unknown> = { ...(extra || {}) };
  meta.moncash_flow = flow === 'redirect' ? 'redirect' : flow === 'ussd' ? 'ussd_push' : 'auto';
  if (ussdReference) meta.ussd_reference = ussdReference;
  return meta;
}

