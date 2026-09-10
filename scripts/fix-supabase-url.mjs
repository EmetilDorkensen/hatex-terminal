/**
 * Si NEXT_PUBLIC_SUPABASE_URL se yon project-ref sèlman, konvèti l an URL konplè.
 * node scripts/fix-supabase-url.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const path = resolve(process.cwd(), '.env.local');
let text = readFileSync(path, 'utf8');

const re = /^NEXT_PUBLIC_SUPABASE_URL=\s*["']?([^\s"']+)["']?\s*$/m;
const m = text.match(re);
if (!m) {
  console.log('NO_URL_LINE');
  process.exit(1);
}

const raw = m[1].trim();
if (/^https?:\/\//i.test(raw)) {
  console.log('ALREADY_FULL_URL');
  process.exit(0);
}

if (!/^[a-z0-9]+$/i.test(raw)) {
  console.log('UNEXPECTED_VALUE');
  process.exit(1);
}

const fixed = `https://${raw}.supabase.co`;
text = text.replace(re, `NEXT_PUBLIC_SUPABASE_URL=${fixed}`);
writeFileSync(path, text);
console.log('FIXED_TO_FULL_URL');
