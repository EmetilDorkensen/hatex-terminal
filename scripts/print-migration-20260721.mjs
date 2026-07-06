import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260721_api_payment_card_or_wallet.sql'
);

console.log('\n=== Migrasyon Supabase obligatwa ===');
console.log('Fichye:', migrationPath);
console.log('\n1. Ale sou Supabase Dashboard > SQL Editor');
console.log('2. Kole epi kouri TOUT kontni fichye a');
console.log('3. Verifye: process_direct_card_payment debite card_balance oswa wallet_balance\n');

const sql = readFileSync(migrationPath, 'utf8');
console.log('--- Preview (premye 500 karaktè) ---');
console.log(sql.slice(0, 500) + '...\n');
