/**
 * Tès bout-an-bout pasrèl peman v2 sou localhost.
 *
 *   node scripts/test-gateway-v2.mjs
 *   node scripts/test-gateway-v2.mjs --email machann@egzanp.com
 *   node scripts/test-gateway-v2.mjs --base http://localhost:3000
 *
 * Sa li fè:
 *   1. Chwazi yon pwofil kòm machann tès
 *   2. Konfigire kont machann nan (status active, nimewo payout)
 *   3. Kreye yon kle API tès
 *   4. POST /v2/payments  — dwe bay yon lyen checkout MonCash
 *   5. Rele l ankò ak menm order_id — dwe bay MENM peman (idempotans)
 *   6. GET /v2/payments/{id} — dwe jwenn peman an
 *   7. Teste rejè: san kle, kle pouri, montan twò gwo
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const BASE = arg('base', 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = arg('email', null);
const PAYOUT_PHONE = arg('phone', '50937201241');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pepper =
  process.env.API_KEY_HASH_SECRET ||
  process.env.CARD_HASH_SECRET ||
  process.env.HATEX_WEBHOOK_SECRET;

if (!url || !serviceKey) {
  console.error('[STOP] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manke.');
  process.exit(1);
}
if (!pepper) {
  console.error('[STOP] CARD_HASH_SECRET (oswa API_KEY_HASH_SECRET) manke.');
  process.exit(1);
}

const db = createClient(url, serviceKey);
let failures = 0;

function ok(label, condition, detail) {
  if (!condition) failures++;
  console.log(`  ${condition ? 'OK   ' : 'ECHWE'} ${label}${detail ? ` — ${detail}` : ''}`);
}

function line() {
  console.log('-'.repeat(64));
}

// ── 1. Chwazi machann ────────────────────────────────────────────
let profileQuery = db.from('profiles').select('id, full_name, email').limit(1);
if (EMAIL) profileQuery = db.from('profiles').select('id, full_name, email').eq('email', EMAIL).limit(1);

const { data: profiles, error: profileErr } = await profileQuery;
if (profileErr || !profiles?.length) {
  console.error('[STOP] Pa jwenn yon pwofil pou sèvi kòm machann:', profileErr?.message || 'vid');
  process.exit(1);
}
const merchant = profiles[0];
console.log(`\nMachann tès: ${merchant.full_name || merchant.email || merchant.id}`);
console.log(`Baz URL:     ${BASE}`);
line();

// ── 2. Konfigire kont machann ────────────────────────────────────
const { error: acctErr } = await db.from('hatex_merchant_accounts').upsert(
  {
    user_id: merchant.id,
    account_type: 'individual',
    status: 'active',
    payout_provider: 'moncash',
    payout_phone: PAYOUT_PHONE,
    auto_payout_enabled: true,
    activated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  { onConflict: 'user_id' }
);
ok('Kont machann konfigire', !acctErr, acctErr?.message);

// ── 3. Kreye kle API tès ─────────────────────────────────────────
const token = 'hx_sk_test_' + crypto.randomBytes(24).toString('hex');
const keyHash = crypto.createHmac('sha256', pepper).update(token).digest('hex');

await db
  .from('hatex_api_keys')
  .update({ is_active: false, revoked_at: new Date().toISOString() })
  .eq('merchant_id', merchant.id)
  .eq('mode', 'test')
  .eq('is_active', true);

const { error: keyErr } = await db.from('hatex_api_keys').insert({
  merchant_id: merchant.id,
  mode: 'test',
  key_hash: keyHash,
  key_prefix: token.slice(0, 19),
  label: 'Tès otomatik',
});
ok('Kle API tès kreye', !keyErr, keyErr?.message);
if (keyErr) process.exit(1);

line();

// ── Zouti HTTP ───────────────────────────────────────────────────
async function call(path, { method = 'GET', body, key } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

// ── 4. Kreye yon peman ───────────────────────────────────────────
const orderId = `TEST-${Date.now()}`;
console.log('Kreyasyon peman:\n');

const created = await call('/v2/payments', {
  method: 'POST',
  key: token,
  body: {
    amount: 500,
    order_id: orderId,
    description: 'Tès pasrèl v2',
    return_url: 'http://localhost:3000/pay/result',
    metadata: { source: 'test-script' },
  },
});

ok('POST /v2/payments bay 201', created.status === 201, `status ${created.status}`);
const payment = created.json?.payment;

if (!payment) {
  console.log('\n  Repons:', JSON.stringify(created.json, null, 2));
  console.log('\nPa ka kontinye san peman.\n');
  process.exit(1);
}

ok('Gen yon lyen checkout', Boolean(payment.checkout_url));
ok('Stati se pending', payment.status === 'pending', payment.status);
ok('Montan machann = 500', payment.amount.merchant === 500, String(payment.amount.merchant));

// Frè: 2% = 10 HTG, payout 1% = 5 HTG (minimòm 5) → total 515
const expectedTotal =
  payment.amount.merchant + payment.amount.platform_fee + payment.amount.payout_fee;
ok(
  'Total kliyan = montan + frè',
  payment.amount.client_total === expectedTotal,
  `${payment.amount.client_total} vs ${expectedTotal}`
);

console.log(`\n  Frè HatexCard:  ${payment.amount.platform_fee} HTG`);
console.log(`  Frè payout:     ${payment.amount.payout_fee} HTG`);
console.log(`  Kliyan peye:    ${payment.amount.client_total} HTG`);
console.log(`  Referans:       ${payment.reference}`);
console.log(`\n  Lyen checkout:\n  ${payment.checkout_url}\n`);

line();

// ── 5. Idempotans ────────────────────────────────────────────────
console.log('Idempotans ak sekirite:\n');

const replay = await call('/v2/payments', {
  method: 'POST',
  key: token,
  body: { amount: 500, order_id: orderId, description: 'Tès pasrèl v2' },
});
ok('Repriz bay 200 (pa 201)', replay.status === 200, `status ${replay.status}`);
ok(
  'Repriz bay menm peman',
  replay.json?.payment?.id === payment.id,
  `${replay.json?.payment?.id} vs ${payment.id}`
);

// ── 6. Li peman an ───────────────────────────────────────────────
const fetched = await call(`/v2/payments/${payment.id}`, { key: token });
ok('GET pa ID mache', fetched.status === 200 && fetched.json?.payment?.id === payment.id);

const byOrder = await call(`/v2/payments/${orderId}`, { key: token });
ok('GET pa order_id mache', byOrder.status === 200 && byOrder.json?.payment?.id === payment.id);

// ── 7. Rejè ──────────────────────────────────────────────────────
const noKey = await call('/v2/payments', {
  method: 'POST',
  body: { amount: 100, order_id: 'X' },
});
ok('San kle → 401', noKey.status === 401, `status ${noKey.status}`);

const badKey = await call('/v2/payments', {
  method: 'POST',
  key: 'hx_sk_test_' + '0'.repeat(48),
  body: { amount: 100, order_id: 'X' },
});
ok('Kle pouri → 401', badKey.status === 401, `status ${badKey.status}`);

const tooBig = await call('/v2/payments', {
  method: 'POST',
  key: token,
  body: { amount: 999999999, order_id: `BIG-${Date.now()}` },
});
ok(
  'Montan twò gwo → 400',
  tooBig.status === 400 && tooBig.json?.error?.code === 'amount_too_large',
  `${tooBig.status} ${tooBig.json?.error?.code}`
);

const tooSmall = await call('/v2/payments', {
  method: 'POST',
  key: token,
  body: { amount: 1, order_id: `SML-${Date.now()}` },
});
ok(
  'Montan twò piti → 400',
  tooSmall.status === 400 && tooSmall.json?.error?.code === 'amount_too_small',
  `${tooSmall.status} ${tooSmall.json?.error?.code}`
);

const noOrder = await call('/v2/payments', {
  method: 'POST',
  key: token,
  body: { amount: 100 },
});
ok(
  'San order_id → 400',
  noOrder.status === 400 && noOrder.json?.error?.code === 'missing_order_id',
  `${noOrder.status} ${noOrder.json?.error?.code}`
);

// Kle tès pa ka li done live
const liveToken = 'hx_sk_live_' + crypto.randomBytes(24).toString('hex');
const fakeLive = await call('/v2/payments', {
  method: 'POST',
  key: liveToken,
  body: { amount: 100, order_id: 'X' },
});
ok('Kle live envante → 401', fakeLive.status === 401, `status ${fakeLive.status}`);

line();
console.log(
  failures === 0
    ? `Tout tès yo pase.\n\nPou fini tès la, ouvri lyen checkout la epi peye ak ${PAYOUT_PHONE}.\n`
    : `${failures} tès echwe — gade anwo.\n`
);
process.exit(failures === 0 ? 0 : 1);
