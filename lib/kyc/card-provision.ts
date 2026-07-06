import type { SupabaseClient } from '@supabase/supabase-js';
import { buildCardSecurityFields } from '@/lib/security/hash';

function generateCardDetails() {
  const random4 = () => Math.floor(1000 + Math.random() * 9000).toString();
  const cardNumber = `4550${random4()}${random4()}${random4()}`;
  const cvv = Math.floor(100 + Math.random() * 900).toString();
  const now = new Date();
  const expDate = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getFullYear() + 3).substring(2)}`;
  return { cardNumber, cvv, expDate };
}

/** Kreye kat vityèl + aktive li otomatikman apre KYC apwouve. */
export async function provisionCardForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ created: boolean; card_number?: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('card_number, card_number_hash, cvv, exp_date, is_card_activated')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('Pwofil pa jwenn.');
  }

  if (profile.card_number && profile.card_number_hash) {
    if (!profile.is_card_activated) {
      await supabase.from('profiles').update({ is_card_activated: true }).eq('id', userId);
    }
    return { created: false, card_number: profile.card_number };
  }

  const { cardNumber, cvv, expDate } = generateCardDetails();
  const securityFields = await buildCardSecurityFields(cardNumber, cvv);

  const { error } = await supabase
    .from('profiles')
    .update({
      card_number: cardNumber,
      cvv,
      exp_date: expDate,
      is_card_activated: true,
      ...securityFields,
    })
    .eq('id', userId);

  if (error) throw error;

  return { created: true, card_number: cardNumber };
}
