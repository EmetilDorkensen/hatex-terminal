/**
 * Make migrasyon ki deja aplike nan yon pwojè (kreye tab si pa la).
 *
 *   node scripts/premark-migrations.mjs            # make tout supabase/migrations
 *   node scripts/premark-migrations.mjs 20260774   # make tout fichye < 20260774
 *
 * Pwojè a: $env:SUPABASE_PROJECT_REF oswa NEXT_PUBLIC_SUPABASE_URL (env) —
 * .env.local itilize sèlman si env pa deja la.
 */

import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
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

const upTo = process.argv[2]; // boundary eksklizif, pa obligatwa
const dir = resolve(process.cwd(), 'supabase/migrations');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .filter((f) => !upTo || f < upTo);

async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

await runSql(`CREATE TABLE IF NOT EXISTS public.hatex_schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`);

const values = files.map((f) => `('${f.replace(/'/g, "''")}')`).join(',');
await runSql(
  `INSERT INTO public.hatex_schema_migrations (filename) VALUES ${values} ON CONFLICT (filename) DO NOTHING;`
);

const rows = await runSql('SELECT filename FROM public.hatex_schema_migrations ORDER BY filename');
console.log(`\n[OK] ${projectRef} — ${rows.length} migrasyon make kòm aplike.`);
console.log('Dènye:', rows.slice(-3).map((r) => r.filename).join(', '));
