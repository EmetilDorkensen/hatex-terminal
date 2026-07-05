/**
 * Apre `git push`, rele Deploy Hook Vercel la (si konfigire).
 * Kreye li nan: Vercel > Project > Settings > Git > Deploy Hooks
 */
const hook = process.env.VERCEL_DEPLOY_HOOK;

if (!hook) {
  console.log('\n[INFO] VERCEL_DEPLOY_HOOK pa mete — ale sou Vercel Dashboard > Deployments > Redeploy branch main.');
  console.log('[INFO] Verifye tou: Settings > Git > repo = EmetilDorkensen/hatex-terminal, branch = main');
  console.log('[INFO] Supabase: kouri migrasyon supabase/migrations/20260721_api_payment_card_or_wallet.sql\n');
  process.exit(0);
}

try {
  const res = await fetch(hook, { method: 'POST' });
  const text = await res.text();
  if (res.ok) {
    console.log('\n[OK] Vercel deploy hook rele avèk siksè.');
  } else {
    console.error('\n[ERÈ] Deploy hook echwe:', res.status, text);
    process.exit(1);
  }
} catch (err) {
  console.error('\n[ERÈ] Pa kapab rele deploy hook:', err.message);
  process.exit(1);
}
