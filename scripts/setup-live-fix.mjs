import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const LIVE_URL = process.env.HATEX_LIVE_URL || 'https://hatexcard.com';
const EXPECTED_BUILD = '20260722-card-balance-v3';
const MAX_ATTEMPTS = 24;
const INTERVAL_MS = 10_000;

async function verifyBuild() {
  const res = await fetch(`${LIVE_URL}/api/public/payments`);
  const versionHeader = res.headers.get('x-hatex-api-version');
  let body = null;
  try {
    body = res.ok ? await res.json() : null;
  } catch {
    body = null;
  }
  const ok =
    res.status !== 405 &&
    (body?.build === EXPECTED_BUILD || versionHeader === EXPECTED_BUILD);
  return { ok, status: res.status, build: body?.build || versionHeader };
}

console.log('\n=== Setup Live Fix ===\n');

const hook = process.env.VERCEL_DEPLOY_HOOK;
if (hook) {
  console.log('[1/3] Rele Vercel Deploy Hook...');
  const res = await fetch(hook, { method: 'POST' });
  if (!res.ok) {
    console.error('[ERÈ] Deploy hook echwe:', res.status, await res.text());
    process.exit(1);
  }
  console.log('[OK] Deploy hook rele.');
} else {
  console.log('[1/3] VERCEL_DEPLOY_HOOK pa mete — fè Redeploy manyèl sou Vercel Dashboard.');
}

if (process.env.SUPABASE_ACCESS_TOKEN) {
  console.log('[2/3] Aplike migrasyon 20260721...');
  const { spawnSync } = await import('child_process');
  const result = spawnSync(process.execPath, ['scripts/apply-migration-20260721.mjs'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
} else {
  console.log('[2/3] SUPABASE_ACCESS_TOKEN pa mete — kouri SQL manyèlman (npm run db:migrate:balance).');
}

console.log(`[3/3] Tann build live (${EXPECTED_BUILD})...`);
for (let i = 1; i <= MAX_ATTEMPTS; i++) {
  const check = await verifyBuild();
  if (check.ok) {
    console.log(`\n[OK] Prod gen build ${EXPECTED_BUILD} (HTTP ${check.status}).`);
    console.log('[INFO] Kouri: npm run test:live\n');
    process.exit(0);
  }
  console.log(`  ... ${i}/${MAX_ATTEMPTS} — HTTP ${check.status}, build=${check.build || 'none'}`);
  if (i < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, INTERVAL_MS));
}

console.error('\n[FAIL] Prod pa gen nouvo kòd apre tann lan. Redeploy Vercel branch main.');
process.exit(1);
