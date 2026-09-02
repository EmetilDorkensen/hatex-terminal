/**
 * Kouri yon rekèt SELECT sou Supabase (lekti sèlman) pou enspeksyon rapid.
 *
 *   node scripts/db-query.mjs "SELECT count(*) FROM public.profiles"
 *   node scripts/db-query.mjs --file chemen/rekèt.sql
 *
 * Refize tout bagay ki pa yon SELECT/WITH — pou pa gen aksidan.
 */

import { readFileSync } from 'fs';
import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');
const sql = (fileIdx !== -1 ? readFileSync(args[fileIdx + 1], 'utf8') : args[0] || '').trim();

if (!sql) {
  console.error('Itilizasyon: node scripts/db-query.mjs "SELECT ..."');
  process.exit(1);
}

if (!/^(select|with)\b/i.test(sql)) {
  console.error('[STOP] Script sa a aksepte SELECT / WITH sèlman.');
  process.exit(1);
}

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!accessToken || !projectRef) {
  console.error('[STOP] SUPABASE_ACCESS_TOKEN / project ref manke nan .env.local');
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();

if (!res.ok) {
  console.error(`[ERÈ ${res.status}]`, text);
  process.exit(1);
}

const rows = text ? JSON.parse(text) : [];
console.log(JSON.stringify(rows, null, 2));
