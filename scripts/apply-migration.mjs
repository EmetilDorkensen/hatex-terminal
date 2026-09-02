/**
 * Aplike yon migrasyon SQL sou Supabase atravè Management API.
 *
 *   node scripts/apply-migration.mjs 20260774_gateway_v2_schema
 *   node scripts/apply-migration.mjs 20260774_gateway_v2_schema.sql
 *   node scripts/apply-migration.mjs 20260774_gateway_v2_schema --dry-run
 *
 * Bezwen nan .env.local:
 *   SUPABASE_ACCESS_TOKEN   (Dashboard > Account > Access Tokens)
 *   SUPABASE_PROJECT_REF    (oswa NEXT_PUBLIC_SUPABASE_URL)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const name = args.find((a) => !a.startsWith('--'));

if (!name) {
  console.error('Itilizasyon: node scripts/apply-migration.mjs <non-migrasyon> [--dry-run]');
  process.exit(1);
}

const fileName = name.endsWith('.sql') ? name : `${name}.sql`;
const migrationPath = resolve(process.cwd(), 'supabase/migrations', fileName);

if (!existsSync(migrationPath)) {
  console.error(`\n[ERÈ] Migrasyon pa jwenn: supabase/migrations/${fileName}\n`);
  process.exit(1);
}

const sql = readFileSync(migrationPath, 'utf8');

if (dryRun) {
  console.log(`\n--- ${fileName} (${sql.split('\n').length} liy) ---\n`);
  console.log(sql);
  process.exit(0);
}

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!accessToken || !projectRef) {
  console.error('\n[STOP] Pou kouri migrasyon otomatikman, mete nan .env.local:');
  console.error('  SUPABASE_ACCESS_TOKEN=...  (Dashboard > Account > Access Tokens)');
  console.error('  SUPABASE_PROJECT_REF=...   (oswa NEXT_PUBLIC_SUPABASE_URL deja la)');
  console.error('\nOswa kopye SQL la nan Supabase SQL Editor:');
  console.error(`  node scripts/apply-migration.mjs ${name} --dry-run\n`);
  process.exit(1);
}

console.log(`\nAp aplike ${fileName} sou pwojè ${projectRef}...`);

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
let body;
try {
  body = text ? JSON.parse(text) : null;
} catch {
  body = text;
}

if (!res.ok) {
  console.error(`\n[ERÈ] Migrasyon echwe (${res.status}):`);
  console.error(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(`[OK] ${fileName} aplike sou Supabase.\n`);
