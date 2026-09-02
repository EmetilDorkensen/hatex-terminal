import { getMonCashConfig, type MonCashConfig } from './config';

/**
 * Kliyan MonCash Business REST API.
 * Tout apèl fèt sou sèvè sèlman — pa janm nan navigatè.
 */

export type MonCashResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status?: number; raw?: unknown };

type TokenCache = { token: string; expiresAt: number };

// Kache pa mòd + kle: platfòm nan ka pale ak sandbox ak live an menm tan, epi
// yon token sandbox pa dwe JANM sèvi pou yon apèl live.
const tokenCaches = new Map<string, TokenCache>();

function cacheKey(cfg: MonCashConfig): string {
  return `${cfg.mode}:${cfg.clientId}`;
}

const TIMEOUT_MS = 20000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

/** Jwenn yon access token OAuth (kliyan credentials). Kache l jiskaske li ekspire. */
export async function getMonCashToken(
  cfg: MonCashConfig = getMonCashConfig()
): Promise<MonCashResult<string>> {
  const now = Date.now();
  const key = cacheKey(cfg);
  const cached = tokenCaches.get(key);
  if (cached && cached.expiresAt > now + 15000) {
    return { ok: true, data: cached.token };
  }

  const basic = Buffer.from(`${cfg.clientId}:${cfg.secretKey}`).toString('base64');
  const body = new URLSearchParams({
    scope: 'read,write',
    grant_type: 'client_credentials',
  });

  let res: Response;
  try {
    res = await fetchWithTimeout(`${cfg.apiBase}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });
  } catch {
    return { ok: false, message: 'Pa ka jwenn MonCash (rezo/timeout).' };
  }

  const json = (await res.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error_description?: string }
    | null;

  if (!res.ok || !json?.access_token) {
    return {
      ok: false,
      message: json?.error_description || 'Otantifikasyon MonCash echwe.',
      status: res.status,
      raw: json,
    };
  }

  const ttlMs = Math.max(Number(json.expires_in || 59), 30) * 1000;
  tokenCaches.set(key, { token: json.access_token, expiresAt: now + ttlMs });
  return { ok: true, data: json.access_token };
}

async function monCashPost<T>(
  path: string,
  payload: Record<string, unknown>,
  cfg: MonCashConfig = getMonCashConfig()
): Promise<MonCashResult<T>> {
  const token = await getMonCashToken(cfg);
  if (!token.ok) return token;

  let res: Response;
  try {
    res = await fetchWithTimeout(`${cfg.apiBase}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.data}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, message: `Pa ka jwenn MonCash (${path}).` };
  }

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok) {
    const detail = json?.message ?? json?.error;
    return {
      ok: false,
      message: typeof detail === 'string' && detail ? detail : `MonCash ${path} echwe.`,
      status: res.status,
      raw: json,
    };
  }

  return { ok: true, data: json as T };
}

// ============================================================
// CREATE PAYMENT
// ============================================================

export type CreatePaymentResponse = {
  redirectUrl: string;
  token: string;
  orderId: string;
  raw: unknown;
};

/**
 * Kreye yon peman MonCash. Retounen lyen redireksyon pou kliyan an.
 * `amount` an HTG, `orderId` dwe inik sou kont machann nan.
 */
export async function createMonCashPayment(
  orderId: string,
  amount: number,
  cfg: MonCashConfig = getMonCashConfig()
): Promise<MonCashResult<CreatePaymentResponse>> {
  if (!orderId || orderId.length > 64) {
    return { ok: false, message: 'orderId pa valab.' };
  }
  // MonCash aksepte montan antye an HTG
  const rounded = Math.round(Number(amount));
  if (!Number.isFinite(rounded) || rounded <= 0) {
    return { ok: false, message: 'Montan pa valab.' };
  }

  const result = await monCashPost<{
    payment_token?: { token?: string; expired?: string; created?: string };
    mode?: string;
    status?: number;
  }>('/v1/CreatePayment', { amount: rounded, orderId }, cfg);

  if (!result.ok) return result;

  const token = result.data?.payment_token?.token;
  if (!token) {
    return { ok: false, message: 'MonCash pa retounen yon token peman.', raw: result.data };
  }

  return {
    ok: true,
    data: {
      token,
      orderId,
      redirectUrl: `${cfg.gatewayBase}/Payment/Redirect?token=${encodeURIComponent(token)}`,
      raw: result.data,
    },
  };
}

// ============================================================
// RETRIEVE PAYMENT (verifikasyon — sous verite a)
// ============================================================

export type MonCashPaymentDetails = {
  transactionId: string;
  orderId: string;
  cost: number;
  payer: string;
  message: string;
  reference?: string | null;
  raw: unknown;
};

type RetrieveRaw = {
  payment?: {
    reference?: string;
    transaction_id?: string;
    cost?: number;
    message?: string;
    payer?: string;
    order_id?: string;
  };
  status?: number;
};

function normalizeDetails(raw: RetrieveRaw, fallbackOrderId?: string): MonCashPaymentDetails | null {
  const p = raw?.payment;
  if (!p?.transaction_id) return null;
  return {
    transactionId: String(p.transaction_id),
    orderId: String(p.order_id || fallbackOrderId || ''),
    cost: Number(p.cost || 0),
    payer: String(p.payer || ''),
    message: String(p.message || ''),
    reference: p.reference ? String(p.reference) : null,
    raw,
  };
}

/** Verifye peman ak orderId nou an. Se sa nou fè konfyans, pa navigatè a. */
export async function retrieveMonCashOrder(
  orderId: string,
  cfg: MonCashConfig = getMonCashConfig()
): Promise<MonCashResult<MonCashPaymentDetails>> {
  const result = await monCashPost<RetrieveRaw>(
    '/v1/RetrieveOrderPayment',
    { orderId },
    cfg
  );
  if (!result.ok) return result;

  const details = normalizeDetails(result.data, orderId);
  if (!details) {
    return { ok: false, message: 'Peman pa jwenn sou MonCash.', raw: result.data };
  }
  return { ok: true, data: details };
}

/** Verifye peman ak transactionId MonCash. */
export async function retrieveMonCashTransaction(
  transactionId: string,
  cfg: MonCashConfig = getMonCashConfig()
): Promise<MonCashResult<MonCashPaymentDetails>> {
  const result = await monCashPost<RetrieveRaw>(
    '/v1/RetrieveTransactionPayment',
    { transactionId },
    cfg
  );
  if (!result.ok) return result;

  const details = normalizeDetails(result.data);
  if (!details) {
    return { ok: false, message: 'Tranzaksyon pa jwenn sou MonCash.', raw: result.data };
  }
  return { ok: true, data: details };
}

// ============================================================
// TRANSFERT (payout bay machann)
// ============================================================

export type MonCashTransferResult = {
  transactionId: string;
  amount: number;
  receiver: string;
  message: string;
  raw: unknown;
};

/**
 * Voye lajan sou yon nimewo MonCash (payout machann).
 * ATANSYON: mande pèmisyon "Transfert" sou kont machann MonCash la.
 */
export async function monCashTransfer(
  params: { receiver: string; amount: number; desc: string; reference: string },
  cfg: MonCashConfig = getMonCashConfig()
): Promise<MonCashResult<MonCashTransferResult>> {
  const receiver = String(params.receiver || '').replace(/\D/g, '');
  if (receiver.length < 8) {
    return { ok: false, message: 'Nimewo MonCash resevè pa valab.' };
  }

  const rounded = Math.round(Number(params.amount));
  if (!Number.isFinite(rounded) || rounded <= 0) {
    return { ok: false, message: 'Montan payout pa valab.' };
  }

  const result = await monCashPost<{
    transfer?: {
      transaction_id?: string;
      amount?: number;
      receiver?: string;
      message?: string;
    };
    status?: number;
  }>(
    '/v1/Transfert',
    {
      amount: rounded,
      receiver,
      desc: String(params.desc || 'Payout HatexCard').slice(0, 120),
      reference: String(params.reference || '').slice(0, 64),
    },
    cfg
  );

  if (!result.ok) return result;

  const t = result.data?.transfer;
  if (!t?.transaction_id) {
    return { ok: false, message: 'MonCash pa konfime transfè a.', raw: result.data };
  }

  return {
    ok: true,
    data: {
      transactionId: String(t.transaction_id),
      amount: Number(t.amount || rounded),
      receiver: String(t.receiver || receiver),
      message: String(t.message || ''),
      raw: result.data,
    },
  };
}

/** Pou tès sèlman — vide cache token an. */
export function resetMonCashTokenCache(): void {
  tokenCaches.clear();
}
