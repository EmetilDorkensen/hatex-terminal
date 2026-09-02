/**
 * Ajoute (oswa ranplase) kle MONCASH_* yo nan .env.local depi yon fichye Vercel.
 *
 *   npx vercel env pull .env.vercel.tmp
 *   node scripts/merge-moncash-env.mjs .env.vercel.tmp
 *   node scripts/merge-moncash-env.mjs .env.vercel.tmp --force   (ranplase sa ki la deja)
 *
 * Li pa janm afiche valè yo — sèlman non kle yo.
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { resolve } from 'path';

const KEYS = ['NEXT_PUBLIC_MONCASH_MODE', 'MONCASH_CLIENT_ID', 'MONCASH_SECRET_KEY'];

const sourcePath = resolve(process.cwd(), process.argv[2] || '.env.vercel.tmp');
const targetPath = resolve(process.cwd(), '.env.local');

if (!existsSync(sourcePath)) {
  console.error(`[ERÈ] Fichye sous pa jwenn: ${sourcePath}`);
  console.error('Kouri anvan: npx vercel env pull .env.vercel.tmp');
  process.exit(1);
}

function parseEnv(text) {
  const out = new Map();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    out.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }
  return out;
}

const force = process.argv.includes('--force');

const source = parseEnv(readFileSync(sourcePath, 'utf8'));
const targetText = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : '';
const target = parseEnv(targetText);

const missing = KEYS.filter((k) => !source.has(k));
if (missing.length) {
  console.log(`[ATANSYON] Pa jwenn sou Vercel: ${missing.join(', ')}`);
}

const available = KEYS.filter((k) => source.has(k));

if (force) {
  // Retire ansyen liy yo epi reekri fichye a
  const kept = targetText
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return !trimmed.startsWith('# MonCash');
      const eq = trimmed.indexOf('=');
      if (eq <= 0) return true;
      return !KEYS.includes(trimmed.slice(0, eq).trim());
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();

  const block = available.map((k) => `${k}=${source.get(k)}`).join('\n');
  writeFileSync(targetPath, `${kept}\n\n# MonCash (rale soti nan Vercel)\n${block}\n`);
  console.log(`[OK] Ranplase nan .env.local: ${available.join(', ')}`);
} else {
  const toAppend = available
    .filter((k) => !target.has(k))
    .map((k) => `${k}=${source.get(k)}`);

  if (!toAppend.length) {
    console.log('[OK] Pa gen kle nouvo pou ajoute. Sèvi ak --force pou ranplase sa ki la deja.');
    process.exit(0);
  }

  const prefix = targetText.length && !targetText.endsWith('\n') ? '\n' : '';
  appendFileSync(targetPath, `${prefix}\n# MonCash (rale soti nan Vercel)\n${toAppend.join('\n')}\n`);
  const addedNames = toAppend.map((l) => l.slice(0, l.indexOf('=')));
  console.log(`[OK] Ajoute nan .env.local: ${addedNames.join(', ')}`);
}

console.log('Sonje efase fichye tanporè a: Remove-Item .env.vercel.tmp');
