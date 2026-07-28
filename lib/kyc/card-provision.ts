import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { buildCardSecurityFields, encryptCardField } from '@/lib/security/hash';

function generateCardDetails() {
  const random4 = () => String(crypto.randomInt(1000, 10000));
  const cardNumber = `4550${random4()}${random4()}${random4()}`;
  const cvv = String(crypto.randomInt(100, 1000));
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

  // Nenpòt idantite kat ki deja la → pa janm kreye yon nouvo nimewo
  if (profile.card_number_hash || profile.card_last4 || profile.card_number) {
    if (activate && !profile.is_card_activated) {
      const { error: actErr } = await supabase
        .from('profiles')
        .update({ is_card_activated: true })
        .eq('id', userId);
      if (actErr) throw new Error(actErr.message);
    }
    return {
      created: false,
      card_last4: profile.card_last4 || undefined,
    };
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

  if (error) {
    const hint =
      /varying\(16\)|too long/i.test(error.message || '')
        ? ' Kouri migrasyon 20260765 (card_number/cvv → TEXT) nan Supabase.'
        : '';
    throw new Error(`${error.message || 'Pa t kapab kreye kat.'}${hint}`);
  }

  return { created: true, card_last4: cardNumber.slice(-4) };
}
