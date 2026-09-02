/**
 * Verifye schema pasrèl v2 la byen aplike sou Supabase.
 *
 *   node scripts/verify-gateway-v2.mjs
 */

import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!accessToken || !projectRef) {
  console.error('[STOP] SUPABASE_ACCESS_TOKEN / project ref manke nan .env.local');
  process.exit(1);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

const EXPECTED_TABLES = [
  'hatex_gateway_settings',
  'hatex_merchant_accounts',
  'hatex_api_keys',
  'hatex_payments',
  'hatex_payouts',
  'hatex_kyc_applications',
];

let failures = 0;

console.log('');

// 1. Tab yo
const tables = await query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = ANY(ARRAY[${EXPECTED_TABLES.map((t) => `'${t}'`).join(',')}]);
`);
const found = new Set(tables.map((r) => r.table_name));
for (const t of EXPECTED_TABLES) {
  const ok = found.has(t);
  if (!ok) failures++;
  console.log(`  ${ok ? 'OK   ' : 'MANKE'} tab ${t}`);
}

// 2. RLS aktive sou chak tab
const rls = await query(`
  SELECT c.relname, c.relrowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY(ARRAY[${EXPECTED_TABLES.map((t) => `'${t}'`).join(',')}]);
`);
console.log('');
for (const row of rls) {
  const ok = row.relrowsecurity === true;
  if (!ok) failures++;
  console.log(`  ${ok ? 'OK   ' : 'PWOBL'} RLS sou ${row.relname}`);
}

// 3. Konfigirasyon seed
const settings = await query(`SELECT key, value, unit FROM public.hatex_gateway_settings ORDER BY key;`);
console.log(`\n  Konfigirasyon (${settings.length} antre):`);
for (const s of settings) {
  console.log(`    ${s.key.padEnd(30)} ${String(s.value).padStart(10)} ${s.unit}`);
}
if (settings.length === 0) failures++;

// 4. Vi a ak security_invoker
const view = await query(`
  SELECT c.reloptions
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'hatex_merchant_monthly_volume';
`);
const opts = view[0]?.reloptions || [];
const invoker = Array.isArray(opts) && opts.some((o) => String(o).includes('security_invoker=on'));
if (!invoker) failures++;
console.log(`\n  ${invoker ? 'OK   ' : 'PWOBL'} vi hatex_merchant_monthly_volume security_invoker`);

// 5. Bucket storage
const bucket = await query(`SELECT id, public FROM storage.buckets WHERE id = 'kyc-documents-v2';`);
const bucketOk = bucket.length > 0 && bucket[0].public === false;
if (!bucketOk) failures++;
console.log(`  ${bucketOk ? 'OK   ' : 'PWOBL'} bucket kyc-documents-v2 (prive)`);

console.log(`\n${failures === 0 ? 'Tout bagay an lòd.' : `${failures} pwoblèm jwenn.`}\n`);
process.exit(failures === 0 ? 0 : 1);
