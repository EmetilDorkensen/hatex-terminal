/**
 * Tès koneksyon MonCash (sandbox).
 *
 *   node scripts/test-moncash.mjs
 *   node scripts/test-moncash.mjs --transfer 50912345678 10
 *
 * Li teste:
 *  1. OAuth token
 *  2. CreatePayment (kreye yon lyen peman tès)
 *  3. RetrieveOrderPayment (dwe echwe — peman poko fèt, sa nòmal)
 *  4. Transfert (SÈLMAN si ou pase --transfer) — verifye pèmisyon payout
 */

import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const MODE = process.env.NEXT_PUBLIC_MONCASH_MODE === 'live' ? 'live' : 'sandbox';
const API_BASE =
  MODE === 'live'
    ? 'https://moncashbutton.digicelgroup.com/Api'
    : 'https://sandbox.moncashbutton.digicelgroup.com/Api';
const GATEWAY_BASE =
  MODE === 'live'
    ? 'https://moncashbutton.digicelgroup.com/Moncash-middleware'
    : 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware';

const CLIENT_ID = process.env.MONCASH_CLIENT_ID;
const SECRET_KEY = process.env.MONCASH_SECRET_KEY;

function line() {
  console.log('-'.repeat(60));
}

if (!CLIENT_ID || !SECRET_KEY) {
  console.error('\n[ERÈ] MONCASH_CLIENT_ID / MONCASH_SECRET_KEY manke nan .env.local');
  console.error('\nRegle sa konsa:');
  console.error('  npx vercel env pull .env.vercel.tmp');
  console.error('  (kopye 3 liy MONCASH_* yo nan .env.local)\n');
  process.exit(1);
}

console.log(`\nMonCash mode: ${MODE}`);
console.log(`API: ${API_BASE}`);

// Dyagnostik fòm kle yo — pa janm afiche valè yo
const shapeProblems = [];
for (const [name, value] of [
  ['MONCASH_CLIENT_ID', CLIENT_ID],
  ['MONCASH_SECRET_KEY', SECRET_KEY],
]) {
  if (/\s/.test(value)) shapeProblems.push(`${name}: gen espas oswa retou-liy ladan l`);
  if (/^["']|["']$/.test(value)) shapeProblems.push(`${name}: antoure ak gimè (" oswa ')`);
  if (value.length < 8) shapeProblems.push(`${name}: twò kout — sanble li koupe`);
}
if (shapeProblems.length) {
  console.log('\n[ATANSYON] Pwoblèm fòm nan .env.local:');
  for (const p of shapeProblems) console.log(`  - ${p}`);
}
line();

async function getToken() {
  const basic = Buffer.from(`${CLIENT_ID}:${SECRET_KEY}`).toString('base64');
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'scope=read%2Cwrite&grant_type=client_credentials',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) {
    if (res.status === 401) {
      throw new Error(
        'OAuth 401 Unauthorized — kle yo pa bon pou mòd sa a.\n\n' +
          'Kòz ki pi souvan:\n' +
          `  1. Kle yo se pou LIVE men nou nan ${MODE} (oswa lòt jan)\n` +
          '  2. Ou chanje kle yo nan Production sou Vercel, men .env.local gen sa ki nan Development\n' +
          '  3. Ou kreye yon nouvo "business" nan pòtay MonCash — chak business gen pwòp kle pa li\n' +
          '  4. Kle a te kopye ak yon espas oswa li koupe\n\n' +
          'Pou rale kle Production yo:\n' +
          '  npx vercel env pull .env.vercel.tmp --environment=production\n' +
          '  node scripts/merge-moncash-env.mjs .env.vercel.tmp --force'
      );
    }
    throw new Error(`OAuth echwe (${res.status}): ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

async function post(token, path, payload) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

let exitCode = 0;

// --probe: eseye otantifikasyon sou sandbox AK live pou wè ki youn kle yo mache avè l.
// OAuth pa deplase okenn lajan — se jis yon verifikasyon idantite.
if (process.argv.includes('--probe')) {
  const basic = Buffer.from(`${CLIENT_ID}:${SECRET_KEY}`).toString('base64');
  const targets = [
    ['sandbox', 'https://sandbox.moncashbutton.digicelgroup.com/Api'],
    ['live', 'https://moncashbutton.digicelgroup.com/Api'],
  ];

  // Teste tou lòd envès (erè kopye/kole ki fèt souvan)
  const swapped = Buffer.from(`${SECRET_KEY}:${CLIENT_ID}`).toString('base64');
  const orders = [
    ['nòmal', basic],
    ['chanje-plas', swapped],
  ];

  console.log('Tès otantifikasyon:\n');
  for (const [name, base] of targets) {
    for (const [orderName, cred] of orders) {
      try {
        const res = await fetch(`${base}/oauth/token`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${cred}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: 'scope=read%2Cwrite&grant_type=client_credentials',
        });
        const json = await res.json().catch(() => null);
        const verdict = json?.access_token ? 'OK <<< KLE YO BON ISIT' : `echwe (${res.status})`;
        console.log(`  ${name.padEnd(9)} ${orderName.padEnd(13)} ${verdict}`);
      } catch (err) {
        console.log(`  ${name.padEnd(9)} ${orderName.padEnd(13)} pa jwenn (${err.message})`);
      }
    }
  }
  line();
  console.log('Si "live" bay OK: mete NEXT_PUBLIC_MONCASH_MODE=live');
  console.log('Si "chanje-plas" bay OK: CLIENT_ID ak SECRET_KEY nan move lòd sou Vercel');
  console.log('Si tout echwe: repran kle yo nan pòtay MonCash (onglè Business > View > REST API)\n');
  process.exit(0);
}

try {
  // 1. TOKEN
  const token = await getToken();
  console.log('[1/4] OAuth token .............. OK');

  // 2. CREATE PAYMENT
  const orderId = `HXTEST-${Date.now()}`;
  const created = await post(token, '/v1/CreatePayment', { amount: 10, orderId });
  const payToken = created.json?.payment_token?.token;

  if (payToken) {
    console.log('[2/4] CreatePayment ............ OK');
    console.log(`      orderId: ${orderId}`);
    console.log(`      lyen:    ${GATEWAY_BASE}/Payment/Redirect?token=${payToken}`);
  } else {
    console.log('[2/4] CreatePayment ............ ECHWE');
    console.log('     ', JSON.stringify(created.json));
    exitCode = 1;
  }

  // 3. RETRIEVE ORDER (nòmalman pa jwenn — peman poko apwouve)
  const retrieved = await post(token, '/v1/RetrieveOrderPayment', { orderId });
  if (retrieved.json?.payment?.transaction_id) {
    console.log('[3/4] RetrieveOrderPayment ..... OK (peman jwenn)');
  } else {
    console.log('[3/4] RetrieveOrderPayment ..... OK (pa gen peman — nòmal, poko peye)');
  }

  // 4. TRANSFERT — pèmisyon payout
  const transferArgIdx = process.argv.indexOf('--transfer');
  if (transferArgIdx === -1) {
    console.log('[4/4] Transfert ................ SOTE');
    console.log('      Pou teste payout: node scripts/test-moncash.mjs --transfer <nimewo> <montan>');
  } else {
    const receiver = process.argv[transferArgIdx + 1];
    const amount = Number(process.argv[transferArgIdx + 2] || 10);
    if (!receiver) {
      console.log('[4/4] Transfert ................ ECHWE (nimewo manke)');
      exitCode = 1;
    } else {
      const transfer = await post(token, '/v1/Transfert', {
        amount,
        receiver: receiver.replace(/\D/g, ''),
        desc: 'Tès payout HatexCard',
        reference: `HXTEST-${Date.now()}`,
      });
      if (transfer.json?.transfer?.transaction_id) {
        console.log('[4/4] Transfert ................ OK — payout otomatik disponib');
        console.log(`      transaction_id: ${transfer.json.transfer.transaction_id}`);
      } else {
        console.log('[4/4] Transfert ................ ECHWE');
        console.log('     ', JSON.stringify(transfer.json));
        console.log('      >> Si se yon erè pèmisyon, kontakte Digicel pou aktive "Transfert"');
        console.log('         sou kont machann nan (MFS_B.Services@digicelgroup.com)');
        exitCode = 1;
      }
    }
  }

  line();
  console.log(exitCode === 0 ? 'Tout tès yo pase.\n' : 'Gen tès ki echwe — gade anwo.\n');
} catch (err) {
  line();
  console.error('[ERÈ]', err.message);
  exitCode = 1;
}

process.exit(exitCode);
