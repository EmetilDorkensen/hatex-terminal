/**
 * Mete kle MonCash yo nan .env.local.
 *
 *   node scripts/set-moncash-env.mjs <client_id> <secret_key> [sandbox|live]
 *
 * Li pa janm afiche valè yo — sèlman non kle ki mete.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const [clientId, secretKey, modeArg] = process.argv.slice(2);

if (!clientId || !secretKey) {
  console.error('Itilizasyon: node scripts/set-moncash-env.mjs <client_id> <secret_key> [sandbox|live]');
  process.exit(1);
}

const mode = modeArg === 'live' ? 'live' : 'sandbox';
const KEYS = ['NEXT_PUBLIC_MONCASH_MODE', 'MONCASH_CLIENT_ID', 'MONCASH_SECRET_KEY'];

const targetPath = resolve(process.cwd(), '.env.local');
const existing = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : '';

const kept = existing
  .split('\n')
  .filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('# MonCash')) return false;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return true;
    return !KEYS.includes(trimmed.slice(0, eq).trim());
  })
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trimEnd();

const block = [
  `NEXT_PUBLIC_MONCASH_MODE=${mode}`,
  `MONCASH_CLIENT_ID=${clientId.trim()}`,
  `MONCASH_SECRET_KEY=${secretKey.trim()}`,
].join('\n');

writeFileSync(targetPath, `${kept}\n\n# MonCash\n${block}\n`);

console.log(`[OK] Mete nan .env.local: ${KEYS.join(', ')} (mode=${mode})`);
