/**
 * Verifye si anon key matche URL pwojè a (san afiche kle).
 * node scripts/probe-anon-key.mjs
 */
import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const service = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function jwtRole(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
    return { role: payload.role || null, ref: payload.ref || null };
  } catch {
    return { role: null, ref: null };
  }
}

const urlRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || null;
const anonMeta = jwtRole(anon);
const serviceMeta = jwtRole(service);

console.log('URL ref present:', Boolean(urlRef));
console.log('Anon JWT role:', anonMeta.role);
console.log('Service JWT role:', serviceMeta.role);
console.log('Anon ref matches URL:', anonMeta.ref === urlRef);
console.log('Service ref matches URL:', serviceMeta.ref === urlRef);

async function hit(label, key) {
  const t = Date.now();
  try {
    const r = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    console.log(`${label}: ${r.status} in ${Date.now() - t}ms`, text.slice(0, 80));
  } catch (e) {
    console.log(`${label}: FAIL in ${Date.now() - t}ms`, e instanceof Error ? e.message : e);
  }
}

await hit('auth settings with ANON', anon);
await hit('auth settings with SERVICE', service);
