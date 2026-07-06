import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const LIVE_URL = process.env.HATEX_LIVE_URL || 'https://hatexcard.com';
const apiKey = process.env.TEST_API_KEY;
const cardNumber = process.env.TEST_CARD_NUMBER;
const cardExp = process.env.TEST_CARD_EXP || '12/28';
const cardCvv = process.env.TEST_CARD_CVV;
const amount = Number(process.env.TEST_AMOUNT || '100');

console.log('\n=== HatexCard Live API Test ===\n');

// 1. Verify build
const getRes = await fetch(`${LIVE_URL}/api/public/payments`);
const getBody = getRes.ok ? await getRes.json() : null;
console.log(`GET /api/public/payments → ${getRes.status}`, getBody?.build || '(no build)');

if (getRes.status === 405 || getBody?.build !== '20260723-api-secure-v4') {
  console.error('\n[STOP] Prod pa gen nouvo kòd. Redeploy Vercel epi kouri: npm run verify:live');
  process.exit(1);
}

if (!apiKey || !cardNumber || !cardCvv) {
  console.log('\n[INFO] Pou test POST, mete nan .env.local:');
  console.log('  TEST_API_KEY=hx_live_...');
  console.log('  TEST_CARD_NUMBER=...');
  console.log('  TEST_CARD_CVV=...');
  console.log('  TEST_CARD_EXP=MM/YY (opsyonèl)');
  console.log('\n[OK] Build verifye. POST test sote (pa gen credentials test).\n');
  process.exit(0);
}

const orderId = `TEST-${Date.now()}`;
const postRes = await fetch(`${LIVE_URL}/api/public/payments`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': orderId,
  },
  body: JSON.stringify({
    amount,
    currency: 'HTG',
    order_id: orderId,
    card_info: { number: cardNumber, exp: cardExp, cvv: cardCvv },
  }),
});

const postBody = await postRes.json();
console.log(`\nPOST /api/public/payments → ${postRes.status}`);
console.log(JSON.stringify(postBody, null, 2));

if (postRes.ok && postBody.success) {
  console.log('\n[OK] Peman reyisi sou live.');
  process.exit(0);
}

if (postBody.balances) {
  console.log('\n[INFO] Balans li nan DB:', postBody.balances);
}

process.exit(postRes.ok ? 0 : 1);
