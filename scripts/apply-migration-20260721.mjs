import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadEnvLocal } from './load-env-local.mjs';

loadEnvLocal();

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260721_api_payment_card_or_wallet.sql'
);
const sql = readFileSync(migrationPath, 'utf8');

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!accessToken || !projectRef) {
  console.error('\n[STOP] Pou kouri migrasyon otomatikman, mete nan .env.local:');
  console.error('  SUPABASE_ACCESS_TOKEN=...  (Dashboard > Account > Access Tokens)');
  console.error('  SUPABASE_PROJECT_REF=...   (oswa NEXT_PUBLIC_SUPABASE_URL deja la)');
  console.error('\nOswa kouri SQL la manyèlman nan Supabase SQL Editor:');
  console.error('  npm run db:migrate:balance\n');
  process.exit(1);
}

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
  console.error('\n[ERÈ] Migrasyon echwe:', res.status, body);
  process.exit(1);
}

console.log('\n[OK] Migrasyon 20260721 aplike sou Supabase.');
console.log('[INFO] Verifye: process_direct_card_payment debite card_balance oswa wallet_balance.\n');
