import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import {
  buildCardSecurityFields,
  decryptCardField,
  encryptCardField,
  isEncryptedCardField,
  maskCardNumber,
} from '@/lib/security/hash';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';

type CardPayload = {
  card_number: string;
  cvv: string;
  exp_date: string | null;
  card_last4: string;
  masked: string;
};

async function buildOwnerCardResponse(
  cardNumberPlain: string,
  cvvPlain: string,
  expDate: string | null
): Promise<CardPayload> {
  return {
    card_number: cardNumberPlain,
    cvv: cvvPlain,
    exp_date: expDate,
    card_last4: cardNumberPlain.slice(-4),
    masked: maskCardNumber(cardNumberPlain),
  };
}

/** Owner-only: retounen kat dechifre. Pa ekspoze via profiles.select. */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimit(`card-ensure:${ip}`, 30, 300);
    if (!rl.allowed) {
      return NextResponse.json({ error: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` }, { status: 429 });
    }

    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Pa konekte.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const reveal = body?.reveal === true;

    const supabase = createSupabaseAdminClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('kyc_status, card_number, cvv, exp_date, card_number_hash, card_last4')
      .eq('id', user.id)
      .single();

    if (!profile || profile.kyc_status !== 'approved') {
      return NextResponse.json({ card: null });
    }

    if (profile.card_number_hash && profile.card_number) {
      let plainNum = decryptCardField(profile.card_number);
      let plainCvv = decryptCardField(profile.cvv);

      // Migrasyon: si te rete plaintext, chifre l kounye a
      if (plainNum && plainCvv && (!isEncryptedCardField(profile.card_number) || !isEncryptedCardField(profile.cvv))) {
        await supabase
          .from('profiles')
          .update({
            card_number: encryptCardField(plainNum),
            cvv: encryptCardField(plainCvv),
          })
          .eq('id', user.id);
      }

      if (!plainNum || !plainCvv) {
        return NextResponse.json({ card: null, error: 'Kat pa ka li.' }, { status: 500 });
      }

      if (!reveal) {
        return NextResponse.json({
          card: {
            card_number: null,
            cvv: null,
            exp_date: profile.exp_date,
            card_last4: profile.card_last4 || plainNum.slice(-4),
            masked: maskCardNumber(plainNum),
          },
        });
      }

      return NextResponse.json({
        card: await buildOwnerCardResponse(plainNum, plainCvv, profile.exp_date),
      });
    }

    const random4 = () => Math.floor(1000 + Math.random() * 9000).toString();
    const newCardNum = `4550${random4()}${random4()}${random4()}`;
    const newCvv = Math.floor(100 + Math.random() * 900).toString();
    const now = new Date();
    const newExp = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getFullYear() + 3).substring(2)}`;

    const securityFields = await buildCardSecurityFields(newCardNum, newCvv);

    await supabase
      .from('profiles')
      .update({
        card_number: encryptCardField(newCardNum),
        cvv: encryptCardField(newCvv),
        exp_date: newExp,
        is_card_activated: true,
        ...securityFields,
      })
      .eq('id', user.id);

    if (!reveal) {
      return NextResponse.json({
        card: {
          card_number: null,
          cvv: null,
          exp_date: newExp,
          card_last4: newCardNum.slice(-4),
          masked: maskCardNumber(newCardNum),
        },
      });
    }

    return NextResponse.json({
      card: await buildOwnerCardResponse(newCardNum, newCvv, newExp),
    });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
