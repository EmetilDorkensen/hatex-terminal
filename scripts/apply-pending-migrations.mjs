/**
 * Aplike TOUT migrasyon SQL ki poko nan Supabase.
 *
 *   node scripts/apply-pending-migrations.mjs
 *   node scripts/apply-pending-migrations.mjs --dry-run
 *   node scripts/apply-pending-migrations.mjs --force 20260777_foo.sql
 *
 * Swiv fichye yo nan supabase/migrations/ (ordre alfabetik).
 * Note yo nan tab public.hatex_schema_migrations.
 *
 * Bezwen: SUPABASE_ACCESS_TOKEN + NEXT_PUBLIC_SUPABASE_URL (oswa SUPABASE_PROJECT_REF)
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const dryRun = process.argv.includes('--dry-run');
const forceIdx = process.argv.indexOf('--force');
const forceFile = forceIdx >= 0 ? process.argv[forceIdx + 1] : null;
const quiet = process.argv.includes('--quiet');

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!accessToken || !projectRef) {
  if (!quiet) {
    console.error('\n[STOP] Mete SUPABASE_ACCESS_TOKEN nan .env.local pou migrasyon otomatik.\n');
  }
  process.exit(quiet ? 0 : 1);
}

const migrationsDir = resolve(process.cwd(), 'supabase/migrations');
if (!existsSync(migrationsDir)) {
  console.error('[ERÈ] Folder supabase/migrations pa jwenn.');
  process.exit(1);
}

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return body;
}

const ENSURE_TABLE = `
CREATE TABLE IF NOT EXISTS public.hatex_schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

await runSql(ENSURE_TABLE);

const appliedRows = await runSql(
  'SELECT filename FROM public.hatex_schema_migrations ORDER BY filename'
);
const applied = new Set(
  (Array.isArray(appliedRows) ? appliedRows : []).map((r) => r.filename)
);

const allFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

// Si gateway v2 deja vivan, pa re-kouri ansyen fichye — make tout fichye
// ki poko note yo kòm aplike (baz la te deja mache san ledger).
{
  const probe = await runSql(
    `SELECT to_regclass('public.hatex_kyc_applications') IS NOT NULL AS ok`
  );
  const alreadyLive = Array.isArray(probe) && probe[0]?.ok === true;
  if (alreadyLive && !forceFile) {
    const missing = allFiles.filter((f) => !applied.has(f));
    // Sèlman bootstrap lè gen anpil fichye ansyen ki manke (premye sèvis ledger)
    if (missing.length > 3) {
      if (!quiet) {
        console.log(
          `\nBaz la deja gen gateway v2. N ap make ${missing.length} fichye migrasyon kòm aplike (pa re-kouri yo)...\n`
        );
      }
      const values = missing
        .map((file) => `('${file.replace(/'/g, "''")}')`)
        .join(',');
      await runSql(
        `INSERT INTO public.hatex_schema_migrations (filename) VALUES ${values} ON CONFLICT (filename) DO NOTHING;`
      );
      if (!quiet) {
        console.log(
          '✓ Done. De pi, sèlman NOUVO fichye nan supabase/migrations/ ap aplike otomatikman (`npm run db:migrate` oswa `npm run dev`).\n'
        );
      }
      process.exit(0);
    }
  }
}

let files = [...allFiles];

if (forceFile) {
  const name = forceFile.endsWith('.sql') ? forceFile : `${forceFile}.sql`;
  files = files.filter((f) => f === name);
  if (!files.length) {
    console.error(`[ERÈ] Fichye pa jwenn: ${name}`);
    process.exit(1);
  }
} else {
  files = files.filter((f) => !applied.has(f));
}

if (!files.length) {
  if (!quiet) console.log('\n✓ Tout migrasyon yo deja aplike. Pa gen anyen pou fè.\n');
  process.exit(0);
}

if (!quiet) {
  console.log(`\nAp aplike ${files.length} migrasyon sou ${projectRef}:`);
  for (const f of files) console.log(`  • ${f}`);
  console.log('');
}

if (dryRun) {
  console.log('(dry-run — pa gen SQL ki kouri)\n');
  process.exit(0);
}

let ok = 0;
for (const file of files) {
  const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
  if (!quiet) console.log(`→ ${file} ...`);
  try {
    await runSql(sql);
    await runSql(
      `INSERT INTO public.hatex_schema_migrations (filename) VALUES ('${file.replace(/'/g, "''")}') ON CONFLICT (filename) DO NOTHING;`
    );
    ok += 1;
    if (!quiet) console.log(`  OK`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Si tab/kolòn deja egziste, note migrasyon an epi kontinye
    if (/already exists|duplicate/i.test(msg)) {
      await runSql(
        `INSERT INTO public.hatex_schema_migrations (filename) VALUES ('${file.replace(/'/g, "''")}') ON CONFLICT (filename) DO NOTHING;`
      );
      if (!quiet) console.log(`  SKIP (deja la)`);
      ok += 1;
      continue;
    }
    console.error(`\n[ERÈ] ${file}:\n${msg}\n`);
    process.exit(1);
  }
}

if (!quiet) console.log(`\n✓ ${ok}/${files.length} migrasyon aplike.\n`);
