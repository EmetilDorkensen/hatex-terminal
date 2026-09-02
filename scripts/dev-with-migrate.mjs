/**
 * Demare Next.js apre migrasyon SQL.
 * Si CRON_SECRET egziste, lanse poller lokal yo (payout + settle MonCash).
 */
import { spawn } from 'child_process';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

function loadEnvLocal() {
  const p = resolve('.env.local');
  if (!existsSync(p)) return;
  const text = readFileSync(p, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const migrate = spawn(process.execPath, [resolve('scripts/apply-pending-migrations.mjs'), '--quiet'], {
  stdio: 'inherit',
  shell: false,
});

migrate.on('close', () => {
  const next = spawn('npx', ['next', 'dev'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  let poller = null;
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  const port = process.env.PORT || '3000';

  if (cronSecret) {
    const payoutTick = async () => {
      try {
        await fetch(`http://127.0.0.1:${port}/api/cron/payouts`, {
          headers: { Authorization: `Bearer ${cronSecret}` },
        });
      } catch {
        /* sèvè poko pare */
      }
    };
    setTimeout(() => {
      void payoutTick();
      poller = setInterval(() => void payoutTick(), 120_000);
    }, 40_000);
    console.log('[payout-poller] Aktif — chak 120s → /api/cron/payouts');

    const moncashTick = async () => {
      try {
        await fetch(`http://127.0.0.1:${port}/api/cron/moncash-settle`, {
          headers: { Authorization: `Bearer ${cronSecret}` },
        });
      } catch {
        /* sèvè poko pare */
      }
    };
    setTimeout(() => {
      void moncashTick();
      setInterval(() => void moncashTick(), 45_000);
    }, 30_000);
    console.log('[moncash-poller] Aktif — chak 45s → /api/cron/moncash-settle');
  } else {
    console.log(
      '[cron-poller] Pa aktif — mete CRON_SECRET nan .env.local pou poll otomatik an lokal.'
    );
  }

  next.on('close', (code) => {
    if (poller) clearInterval(poller);
    process.exit(code ?? 0);
  });
});
