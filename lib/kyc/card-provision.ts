import type { SupabaseClient } from '@supabase/supabase-js';
import { buildCardSecurityFields, encryptCardField } from '@/lib/security/hash';

function generateCardDetails() {
  const random4 = () => Math.floor(1000 + Math.random() * 9000).toString();
  const cardNumber = `4550${random4()}${random4()}${random4()}`;
  const cvv = Math.floor(100 + Math.random() * 900).toString();
  const now = new Date();
  const expDate = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getFullYear() + 3).substring(2)}`;
  return { cardNumber, cvv, expDate };
}

export type ProvisionCardOptions = {
  /** true = debloke itilizasyon; false = kreye kat men rete bloke (kle). */
  activate?: boolean;
};

/**
 * Kreye kat vityèl (PAN/CVV chifre at-rest).
 * Apre KYC apwouve: activate=false (kle jiskaske dezyèm 525).
 * Apre unlock fee: activate=true.
 */
export async function provisionCardForUser(
  supabase: SupabaseClient,
  userId: string,
  options: ProvisionCardOptions = {}
): Promise<{ created: boolean; card_last4?: string }> {
  const activate = options.activate === true;

  const { data: profile } = await supabase
    .from('profiles')
    .select('card_number, card_number_hash, card_last4, exp_date, is_card_activated')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('Pwofil pa jwenn.');
  }

  if (profile.card_number_hash) {
    if (activate && !profile.is_card_activated) {
      await supabase.from('profiles').update({ is_card_activated: true }).eq('id', userId);
    }
    return { created: false, card_last4: profile.card_last4 || undefined };
  }

  const { cardNumber, cvv, expDate } = generateCardDetails();
  const securityFields = await buildCardSecurityFields(cardNumber, cvv);

  const { error } = await supabase
    .from('profiles')
    .update({
      card_number: encryptCardField(cardNumber),
      cvv: encryptCardField(cvv),
      exp_date: expDate,
      is_card_activated: activate,
      ...securityFields,
    })
    .eq('id', userId);

  if (error) throw error;

  return { created: true, card_last4: cardNumber.slice(-4) };
}
