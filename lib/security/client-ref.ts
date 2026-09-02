import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Referans piblik opak pou chak kont (client_ref).
 *
 * Prensip: lè yon machann resevwa lajan atravè API / fakti / plugin / pwodwi,
 * nou anrejistre client_ref li a (receiver_ref) nan metadata peman an. Konsa,
 * kèlkeswa kanal la, sistèm nan ka konnen kiyès k ap resevwa lajan an epi li
 * ka reyaji byen vit ak sa MonCash di (aksepte / rejte).
 */

/** Jenere yon nouvo client_ref opak (24 karaktè hex — san enfòmasyon entèn). */
export function makeClientRef(): string {
  return crypto.randomBytes(12).toString('hex');
}

/**
 * Garanti yon pwofil gen yon client_ref epi retounen li.
 * Si kolòn nan poko gen valè (vyè kont), nou ranpli l avèk yon token opak.
 * Idempotan: pa janm chanje yon client_ref ki deja egziste.
 */
export async function ensureProfileClientRef(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  if (!userId) return null;

  const { data } = await supabase
    .from('profiles')
    .select('client_ref')
    .eq('id', userId)
    .maybeSingle();

  const existing =
    typeof data?.client_ref === 'string' && data.client_ref ? data.client_ref : null;
  if (existing) return existing;

  const candidate = makeClientRef();
  const { data: upd } = await supabase
    .from('profiles')
    .update({ client_ref: candidate })
    .eq('id', userId)
    .is('client_ref', null)
    .select('client_ref')
    .maybeSingle();

  if (upd?.client_ref) return String(upd.client_ref);

  // Yon lòt kous te ka ranpli antretan (23505) — re-chaje li.
  const { data: again } = await supabase
    .from('profiles')
    .select('client_ref')
    .eq('id', userId)
    .maybeSingle();

  return typeof again?.client_ref === 'string' && again.client_ref
    ? String(again.client_ref)
    : null;
}
