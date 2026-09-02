import type { SupabaseClient } from '@supabase/supabase-js';

export async function listMoncashPhones(
  admin: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data } = await admin
    .from('hatex_bank_accounts')
    .select('phone, is_default, created_at')
    .eq('user_id', userId)
    .eq('kind', 'moncash')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  const phones: string[] = [];
  const seen = new Set<string>();
  for (const row of data || []) {
    const digits = String(row.phone || '').replace(/\D/g, '');
    if (digits.length < 8) continue;
    if (seen.has(digits)) continue;
    seen.add(digits);
    phones.push(digits);
  }

  if (phones.length === 0) {
    const { data: acct } = await admin
      .from('hatex_merchant_accounts')
      .select('payout_phone')
      .eq('user_id', userId)
      .maybeSingle();
    const digits = String(acct?.payout_phone || '').replace(/\D/g, '');
    if (digits.length >= 8) phones.push(digits);
  }

  return phones;
}

export function looksLikeWalletFull(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return /plen|full|limit|maximum|max\.|capacite|capacité|exceed|ceiling|sature|depase|wallet.*(full|limit)|account.*(full|limit)/i.test(
    m
  );
}

export function maskPhone(phone: string): string {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length < 4) return d;
  return `${d.slice(0, 3)}••••${d.slice(-4)}`;
}
