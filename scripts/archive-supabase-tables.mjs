/**
 * Archive (JSON) tout tab piblik + auth.users/identities nan yon pwojè Supabase.
 *
 *   node scripts/archive-supabase-tables.mjs [folder]
 *
 * Pwojè a chwazi nan SUPABASE_PROJECT_REF oswa NEXT_PUBLIC_SUPABASE_URL
 * (env ki deja la yo gen priyorite sou .env.local).
 *
 * Itilizasyon:
 *   $env:SUPABASE_PROJECT_REF='psdnklsqttyqhqhkhmgq'
 *   node scripts/archive-supabase-tables.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
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

const folder = resolve(
  process.cwd(),
  process.argv[2] || `backups/${new Date().toISOString().slice(0, 10)}-${projectRef}`
);
mkdirSync(folder, { recursive: true });

async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : [];
}

async function archiveTable(schema, table, outName) {
  const countRows = await runSql(`SELECT count(*) AS n FROM ${schema}.${table}`);
  const n = Number(countRows?.[0]?.n ?? 0);
  if (n === 0) return { table: `${schema}.${table}`, rows: 0 };
  const rows = await runSql(`SELECT * FROM ${schema}.${table} LIMIT 100000`);
  const target = resolve(folder, `${outName || table}.json`);
  writeFileSync(target, JSON.stringify(rows, null, 1));
  return { table: `${schema}.${table}`, rows: rows.length, file: target };
}

console.log(`\n=== Archive ${projectRef} → ${folder} ===\n`);

const report = [];

// Tab piblik ki gen done
try {
  const tables = await runSql(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
  );
  for (const { tablename } of tables) {
    try {
      const r = await archiveTable('public', tablename, `public__${tablename}`);
      if (r.rows > 0) report.push(r);
    } catch (err) {
      report.push({ table: `public.${tablename}`, rows: -1, error: err.message });
    }
  }
} catch (err) {
  console.error('[ERÈ] Pa kapab lise tab yo:', err.message);
}

// auth schema
for (const [table, out] of [
  ['auth.users', 'auth__users'],
  ['auth.identities', 'auth__identities'],
]) {
  try {
    const r = await archiveTable('auth', table.replace('auth.', ''), out);
    if (r.rows > 0) report.push(r);
  } catch (err) {
    report.push({ table, rows: -1, error: err.message });
  }
}

for (const r of report) {
  if (r.error) console.log(`  [ERÈ] ${r.table}: ${r.error}`);
  else console.log(`  ✓ ${r.table} → ${r.rows} ranje`);
}

console.log(`\n✓ Achiv fini. Kote: ${folder}\n`);
