import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const hook = process.env.VERCEL_DEPLOY_HOOK;

if (!hook) {
  console.error(`
[ERÈ] VERCEL_DEPLOY_HOOK pa mete nan .env.local — sit la PA deplwaye.

Push GitHub ka reyisi, MEN Vercel pa resevwa okenn lòd deploy.

Fè sa kounye a:
1. Vercel → pwojè hatexcard → Settings → Git → Deploy Hooks
2. Kreye yon hook (non: main, branch: main)
3. Kopiye URL hook la nan .env.local:
   VERCEL_DEPLOY_HOOK=https://api.vercel.com/v1/integrations/deploy/...

4. Oswa Redeploy manyèl:
   Vercel → Deployments → Redeploy (branch main)

5. Apre sa: npm run live
`);
  process.exit(1);
}

try {
  const res = await fetch(hook, { method: 'POST' });
  const text = await res.text();
  if (res.ok) {
    console.log('\n[OK] Vercel deploy hook rele. Tann ~1–3 min.');
    console.log('[INFO] Verifye: Vercel → Deployments (dwe genyen yon nouvo build Ready)\n');
  } else {
    console.error('\n[ERÈ] Deploy hook echwe:', res.status, text);
    process.exit(1);
  }
} catch (err) {
  console.error('\n[ERÈ] Pa kapab rele deploy hook:', err.message);
  process.exit(1);
}
