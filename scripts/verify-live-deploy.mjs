const LIVE_URL = process.env.HATEX_LIVE_URL || 'https://hatexcard.com';
const EXPECTED_BUILD = '20260722-card-balance-v3';

const res = await fetch(`${LIVE_URL}/api/public/payments`);
const versionHeader = res.headers.get('x-hatex-api-version');
const text = await res.text();

let body = null;
try {
  body = text ? JSON.parse(text) : null;
} catch {
  body = null;
}

console.log(`\n=== Verify Live Deploy ===`);
console.log(`URL: ${LIVE_URL}/api/public/payments`);
console.log(`HTTP: ${res.status}`);
console.log(`X-Hatex-Api-Version: ${versionHeader || '(absent)'}`);

if (res.status === 405) {
  console.error('\n[FAIL] Prod toujou sou ANSYEN kòd (405). Fè Redeploy sou Vercel branch main.');
  process.exit(1);
}

if (body?.build === EXPECTED_BUILD || versionHeader === EXPECTED_BUILD) {
  console.log(`[OK] Build live: ${EXPECTED_BUILD}`);
  process.exit(0);
}

console.error(`\n[FAIL] Build atann "${EXPECTED_BUILD}", resevwa:`, body?.build || versionHeader || text);
process.exit(1);
