/**
 * Dyagnostik lokal — pa afiche okenn kle / URL konplè.
 * node scripts/probe-supabase-health.mjs
 */
import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const service = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || null;

console.log('URL present:', Boolean(url));
console.log('URL host ok:', /supabase\.co/.test(url));
console.log('Anon key present:', Boolean(anon), 'len', anon.length);
console.log('Service key present:', Boolean(service), 'len', service.length);
console.log('Access token present:', Boolean(token));
console.log('Project ref parsed:', Boolean(ref));

async function timed(label, fn) {
  const t = Date.now();
  try {
    const r = await fn();
    console.log(`${label}: OK in ${Date.now() - t}ms`, String(r).slice(0, 200));
  } catch (e) {
    console.log(`${label}: FAIL in ${Date.now() - t}ms ->`, e instanceof Error ? e.message : e);
  }
}

if (!url) {
  console.log('NO URL — verifye NEXT_PUBLIC_SUPABASE_URL nan .env.local');
  process.exit(1);
}

await timed('auth health', async () => {
  const r = await fetch(`${url}/auth/v1/health`, { signal: AbortSignal.timeout(20000) });
  return `${r.status} ${(await r.text()).slice(0, 100)}`;
});

await timed('rest root', async () => {
  const r = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    signal: AbortSignal.timeout(20000),
  });
  return `${r.status} ${(await r.text()).slice(0, 100)}`;
});

await timed('profiles select', async () => {
  const key = service || anon;
  const r = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(25000),
  });
  return `${r.status} ${(await r.text()).slice(0, 120)}`;
});

if (token && ref) {
  await timed('mgmt project status', async () => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    const j = await r.json();
    return `${r.status} name=${j.name || '?'} status=${j.status || j.message || JSON.stringify(j).slice(0, 120)}`;
  });

  await timed('list all projects', async () => {
    const r = await fetch('https://api.supabase.com/v1/projects', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    const j = await r.json();
    if (!Array.isArray(j)) return `${r.status} ${JSON.stringify(j).slice(0, 160)}`;
    return j
      .map((p) => `${p.name}|${p.status}|ref=${String(p.id || '').slice(0, 4)}…${String(p.id || '').slice(-4)}|envMatch=${p.id === ref}`)
      .join(' || ');
  });
}

// DNS / TCP diagnostics (no secrets)
try {
  const host = new URL(url).hostname;
  const dns = await import('node:dns/promises');
  const addrs = await dns.lookup(host, { all: true });
  console.log('DNS host:', host.replace(/^(.{6}).+(.{6})$/, '$1…$2'));
  console.log('DNS ok:', addrs.map((a) => a.family).join(','));
} catch (e) {
  console.log('DNS FAIL:', e instanceof Error ? e.message : e);
}

await timed('raw https GET project root', async () => {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'manual' });
  return `${r.status}`;
});
