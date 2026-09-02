/**
 * Tès envaryan KYC v2 nan baz done a.
 *
 *   node scripts/test-kyc-v2.mjs
 *
 * Sa li pwouve:
 *   1. Yon bouyon ka egziste ak chan vid (moun ranpli l ti kras pa ti kras)
 *   2. Yon dosye PA KA soumèt san frè a peye — kontrent baz done a bloke l
 *   3. Yon dosye PA KA soumèt si dokiman obligatwa yo manke
 *   4. Ak frè peye + tout chan yo, soumisyon an pase
 *   5. Menm pyès idantite pa ka sèvi de fwa
 *   6. Frè KYC pa konte nan volim machann nan
 *
 * Tout done tès efase nan fen an.
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('[STOP] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manke.');
  process.exit(1);
}

const db = createClient(url, serviceKey);
let failures = 0;
const createdIds = [];

function ok(label, condition, detail) {
  if (!condition) failures++;
  console.log(`  ${condition ? 'OK   ' : 'ECHWE'} ${label}${detail ? ` — ${detail}` : ''}`);
}

const { data: profiles } = await db.from('profiles').select('id, email').limit(1);
if (!profiles?.length) {
  console.error('[STOP] Pa gen pwofil pou teste.');
  process.exit(1);
}
const userId = profiles[0].id;

console.log(`\nPwofil tès: ${profiles[0].email || userId}`);
console.log('-'.repeat(64));

// Netwaye dosye tès ki ta ka rete depi yon kouri anvan
await db.from('hatex_kyc_applications').delete().eq('user_id', userId).eq('activity_category', 'Lòt');

const COMPLETE = {
  user_id: userId,
  account_type: 'individual',
  full_name: 'Tès Otomatik',
  date_of_birth: '1995-06-15',
  address_street: '10 Ri Tès',
  address_city: 'Pòtoprens',
  address_department: 'Lwès',
  phone_primary: '50937201241',
  email: 'tes@egzanp.com',
  activity_category: 'Lòt',
  payout_provider: 'moncash',
  payout_phone: '50937201241',
  id_document_type: 'cin',
  id_front_path: `${userId}/id_front_test.jpg`,
  id_back_path: `${userId}/id_back_test.jpg`,
  selfie_path: `${userId}/selfie_test.jpg`,
  liveness_passed: true,
};

// ── 1. Bouyon ak chan vid ───────────────────────────────────────
const { data: draft, error: draftErr } = await db
  .from('hatex_kyc_applications')
  .insert({ user_id: userId, account_type: 'individual', status: 'draft', activity_category: 'Lòt' })
  .select('id')
  .maybeSingle();

ok('Bouyon ak chan vid aksepte', !draftErr && Boolean(draft), draftErr?.message);
if (draft) createdIds.push(draft.id);
if (!draft) process.exit(1);

// ── 2. Soumèt san frè peye → dwe bloke ──────────────────────────
const { error: noFeeErr } = await db
  .from('hatex_kyc_applications')
  .update({ ...COMPLETE, status: 'submitted', fee_paid: false })
  .eq('id', draft.id);

ok(
  'Soumisyon san frè peye BLOKE',
  Boolean(noFeeErr),
  noFeeErr ? `kontrent aktive (${noFeeErr.code})` : 'PWOBLÈM: li pase!'
);

// ── 3. Soumèt san dokiman → dwe bloke ───────────────────────────
const { error: noDocErr } = await db
  .from('hatex_kyc_applications')
  .update({
    ...COMPLETE,
    id_front_path: null,
    selfie_path: null,
    status: 'submitted',
    fee_paid: true,
  })
  .eq('id', draft.id);

ok(
  'Soumisyon san dokiman BLOKE',
  Boolean(noDocErr),
  noDocErr ? 'kontrent aktive' : 'PWOBLÈM: li pase!'
);

// ── 4. Ak frè peye + tout chan → dwe pase ───────────────────────
const idHash = crypto.randomBytes(32).toString('hex');
const { error: fullErr } = await db
  .from('hatex_kyc_applications')
  .update({
    ...COMPLETE,
    status: 'submitted',
    fee_paid: true,
    fee_amount: 1920,
    fee_paid_at: new Date().toISOString(),
    submitted_at: new Date().toISOString(),
    id_number_hash: idHash,
    id_number_last4: '1234',
  })
  .eq('id', draft.id);

ok('Soumisyon konplè ak frè peye PASE', !fullErr, fullErr?.message);

// ── 5. Menm pyès idantite de fwa → dwe bloke ────────────────────
const { data: dup, error: dupErr } = await db
  .from('hatex_kyc_applications')
  .insert({
    ...COMPLETE,
    status: 'submitted',
    fee_paid: true,
    submitted_at: new Date().toISOString(),
    id_number_hash: idHash,
    id_number_last4: '1234',
  })
  .select('id')
  .maybeSingle();

if (dup) createdIds.push(dup.id);
ok(
  'Menm pyès idantite de fwa BLOKE',
  Boolean(dupErr),
  dupErr ? `kontrent inik (${dupErr.code})` : 'PWOBLÈM: doub pase!'
);

// ── 6. Frè KYC pa konte nan volim machann ───────────────────────
const orderId = `kyctest_${Date.now()}`;
const { data: feePayment, error: payErr } = await db
  .from('hatex_payments')
  .insert({
    merchant_id: userId,
    mode: 'test',
    purpose: 'kyc_fee',
    merchant_order_id: orderId,
    gateway_order_id: `hxk_${crypto.randomBytes(10).toString('hex')}`,
    merchant_amount: 0,
    platform_fee: 1920,
    payout_fee: 0,
    client_total: 1920,
    status: 'paid',
    paid_at: new Date().toISOString(),
  })
  .select('id')
  .maybeSingle();

ok('Peman frè KYC ak merchant_amount = 0 aksepte', !payErr, payErr?.message);

if (feePayment) {
  const { data: volume } = await db
    .from('hatex_merchant_monthly_volume')
    .select('total_htg, payment_count')
    .eq('merchant_id', userId)
    .eq('mode', 'test');

  const total = (volume || []).reduce((s, r) => s + Number(r.total_htg || 0), 0);
  ok(
    'Frè KYC pa konte nan volim machann',
    !(volume || []).some((r) => Number(r.total_htg) === 1920),
    `volim total: ${total}`
  );

  await db.from('hatex_payments').delete().eq('id', feePayment.id);
}

// ── Netwayaj ────────────────────────────────────────────────────
for (const id of createdIds) {
  await db.from('hatex_kyc_applications').delete().eq('id', id);
}

console.log('-'.repeat(64));
console.log(failures === 0 ? 'Tout envaryan yo kenbe.\n' : `${failures} pwoblèm jwenn.\n`);
process.exit(failures === 0 ? 0 : 1);
