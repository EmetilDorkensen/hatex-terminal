import { SupabaseClient } from '@supabase/supabase-js';
import {
  buildCardSecurityFields,
  cleanCardNumber,
  hashCardNumber,
  verifyCvv,
} from './hash';

type CardProfile = {
  id: string;
  wallet_balance?: number | null;
  full_name?: string | null;
  account_status?: string | null;
  exp_date?: string | null;
  card_number?: string | null;
  cvv?: string | null;
  card_number_hash?: string | null;
  cvv_hash?: string | null;
};

function matchesExpiry(profileExp: string | null | undefined, rawExp: string, slashedExp: string): boolean {
  if (!profileExp) return false;
  const normalized = profileExp.replace(/\D/g, '');
  const raw = rawExp.replace(/\D/g, '');
  return profileExp === rawExp || profileExp === slashedExp || normalized === raw;
}

async function upgradeLegacyCard(
  supabase: SupabaseClient,
  profile: CardProfile,
  cleanCard: string,
  cvv: string
) {
  const fields = await buildCardSecurityFields(cleanCard, cvv);
  await supabase
    .from('profiles')
    .update({
      ...fields,
      card_number: cleanCard,
    })
    .eq('id', profile.id);
}

export async function findProfileByCard(
  supabase: SupabaseClient,
  cardNumber: string,
  cvv: string,
  rawExp: string,
  slashedExp: string
): Promise<{ profile: CardProfile | null; error?: string }> {
  const cleanCard = cleanCardNumber(cardNumber);
  const cardHash = hashCardNumber(cleanCard);

  const { data: hashedProfile } = await supabase
    .from('profiles')
    .select('id, wallet_balance, full_name, account_status, exp_date, cvv_hash, card_number_hash, card_last4')
    .eq('card_number_hash', cardHash)
    .maybeSingle();

  if (hashedProfile) {
    const cvvOk = await verifyCvv(cvv, hashedProfile.cvv_hash);
    if (!cvvOk) return { profile: null, error: 'CVV pa bon.' };
    if (!matchesExpiry(hashedProfile.exp_date, rawExp, slashedExp)) {
      return { profile: null, error: 'Dat ekspirasyon pa bon.' };
    }
    return { profile: hashedProfile };
  }

  const { data: legacyProfile } = await supabase
    .from('profiles')
    .select('id, wallet_balance, full_name, account_status, exp_date, card_number, cvv')
    .eq('card_number', cleanCard)
    .maybeSingle();

  if (!legacyProfile) return { profile: null };

  if (String(legacyProfile.cvv) !== String(cvv)) {
    return { profile: null, error: 'CVV pa bon.' };
  }
  if (!matchesExpiry(legacyProfile.exp_date, rawExp, slashedExp)) {
    return { profile: null, error: 'Dat ekspirasyon pa bon.' };
  }

  await upgradeLegacyCard(supabase, legacyProfile, cleanCard, cvv);
  return { profile: legacyProfile };
}

export async function findProfileByCardSimple(
  supabase: SupabaseClient,
  cardNumber: string,
  cvv: string
): Promise<{ profile: CardProfile | null; error?: string }> {
  const cleanCard = cleanCardNumber(cardNumber);
  const cardHash = hashCardNumber(cleanCard);

  const { data: hashedProfile } = await supabase
    .from('profiles')
    .select('id, wallet_balance, full_name, account_status, cvv_hash')
    .eq('card_number_hash', cardHash)
    .maybeSingle();

  if (hashedProfile) {
    const cvvOk = await verifyCvv(cvv, hashedProfile.cvv_hash);
    if (!cvvOk) return { profile: null, error: 'CVV pa bon.' };
    return { profile: hashedProfile };
  }

  const { data: legacyProfile } = await supabase
    .from('profiles')
    .select('id, wallet_balance, full_name, account_status, card_number, cvv')
    .eq('card_number', cleanCard)
    .eq('cvv', String(cvv))
    .maybeSingle();

  if (legacyProfile) {
    await upgradeLegacyCard(supabase, legacyProfile, cleanCard, cvv);
  }
  return { profile: legacyProfile };
}
