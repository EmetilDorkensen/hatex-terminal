import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const hook = process.env.VERCEL_DEPLOY_HOOK;

if (!hook) {
  console.log('\n[INFO] VERCEL_DEPLOY_HOOK pa mete nan .env.local');
  console.log('[INFO] Vercel > Settings > Git > Deploy Hooks > kreye hook "main"');
  console.log('[INFO] Apre sa: npm run verify:live pou konfime build sou prod');
  console.log('[INFO] Oswa Redeploy manyèl: Vercel Dashboard > Deployments > Redeploy main\n');
  process.exit(0);
}

try {
  const res = await fetch(hook, { method: 'POST' });
  const text = await res.text();
  if (res.ok) {
    console.log('\n[OK] Vercel deploy hook rele. Tann ~2 min epi kouri: npm run verify:live');
  } else {
    console.error('\n[ERÈ] Deploy hook echwe:', res.status, text);
    process.exit(1);
  }
} catch (err) {
  console.error('\n[ERÈ] Pa kapab rele deploy hook:', err.message);
  process.exit(1);
}
