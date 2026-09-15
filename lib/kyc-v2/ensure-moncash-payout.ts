/**
 * Anrejistre nimewo MonCash KYC kòm premye nimewo payout (default).
 * Kliyan an ka siprime l pita nan paramèt payout.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

function digitsOnly(raw: unknown): string {
  return String(raw || '').replace(/\D/g, '');
}

export type KycPayoutSource = {
  payout_phone?: string | null;
  party1_moncash?: string | null;
  party2_moncash?: string | null;
  account_type?: string | null;
};

/**
 * Premye nimewo = payout_phone (endividyèl) oswa party1_moncash / payout_phone (biznis).
 * Li vin `is_default` si pa gen lòt MonCash default deja.
 */
export async function ensureKycMoncashPayoutAccounts(
  admin: SupabaseClient,
  userId: string,
  app: KycPayoutSource
): Promise<{ primaryPhone: string | null }> {
  const primary = digitsOnly(app.party1_moncash || app.payout_phone);
  const secondary = digitsOnly(app.party2_moncash);

  const phones: { phone: string; label: string; preferDefault: boolean }[] = [];
  if (primary.length >= 8) {
    phones.push({
      phone: primary,
      label: app.account_type === 'business' ? 'MonCash reprezantan (KYC)' : 'MonCash payout (KYC)',
      preferDefault: true,
    });
  }
  if (secondary.length >= 8 && secondary !== primary) {
    phones.push({
      phone: secondary,
      label: 'MonCash dezyèm moun (KYC)',
      preferDefault: false,
    });
  }

  if (!phones.length) return { primaryPhone: null };

  const { data: existingDefault } = await admin
    .from('hatex_bank_accounts')
    .select('id, phone')
    .eq('user_id', userId)
    .eq('kind', 'moncash')
    .eq('is_default', true)
    .maybeSingle();

  for (const row of phones) {
    const { data: existing } = await admin
      .from('hatex_bank_accounts')
      .select('id, is_default')
      .eq('user_id', userId)
      .eq('kind', 'moncash')
      .eq('phone', row.phone)
      .maybeSingle();

    if (existing) {
      // Si se premye nimewo KYC a epi pa gen default, fè li default
      if (row.preferDefault && !existingDefault && !existing.is_default) {
        await admin
          .from('hatex_bank_accounts')
          .update({ is_default: true, is_verified: true, label: row.label })
          .eq('id', existing.id);
      }
      continue;
    }

    const makeDefault = row.preferDefault && !existingDefault;
    await admin.from('hatex_bank_accounts').insert({
      user_id: userId,
      kind: 'moncash',
      label: row.label,
      phone: row.phone,
      is_default: makeDefault,
      is_verified: true,
    });
  }

  if (primary.length >= 8) {
    await admin
      .from('hatex_merchant_accounts')
      .update({ payout_phone: primary, payout_provider: 'moncash' })
      .eq('user_id', userId);
  }

  return { primaryPhone: primary.length >= 8 ? primary : null };
}
