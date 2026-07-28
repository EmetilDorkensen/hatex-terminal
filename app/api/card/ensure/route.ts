import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import {
  decryptCardField,
  encryptCardField,
  isEncryptedCardField,
  maskCardNumber,
} from '@/lib/security/hash';
import { provisionCardForUser } from '@/lib/kyc/card-provision';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';

type CardPayload = {
  card_number: string | null;
  cvv: string | null;
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

function hasStoredCard(profile: {
  card_number?: string | null;
  card_number_hash?: string | null;
  card_last4?: string | null;
}): boolean {
  return !!(profile.card_number_hash || profile.card_last4 || profile.card_number);
}

/** Owner-only: retounen kat dechifre. Pa janm kreye yon NOUVO nimewo sou reload. */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimit(`card-ensure:${ip}`, 30, 300);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Pa konekte.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const reveal = body?.reveal === true;

    const supabase = createSupabaseAdminClient();

    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select(
          'kyc_status, is_card_activated, features_unlock_paid, card_number, cvv, exp_date, card_number_hash, card_last4'
        )
        .eq('id', user.id)
        .single();
      return data;
    };

    let profile = await loadProfile();

    if (!profile || profile.kyc_status !== 'approved') {
      return NextResponse.json({ card: null });
    }

    const unlocked =
      profile.is_card_activated === true || profile.features_unlock_paid === true;

    // Kat deja nan baz — pa janm regeneré nimewo a
    if (hasStoredCard(profile)) {
      let plainNum = decryptCardField(profile.card_number);
      let plainCvv = decryptCardField(profile.cvv);

      // Migrasyon legacy plaintext → chifre (yon fwa). Pa chanje PAN.
      if (
        plainNum &&
        plainCvv &&
        (!isEncryptedCardField(profile.card_number) || !isEncryptedCardField(profile.cvv))
      ) {
        const { error: encErr } = await supabase
          .from('profiles')
          .update({
            card_number: encryptCardField(plainNum),
            cvv: encryptCardField(plainCvv),
          })
          .eq('id', user.id);
        if (encErr) {
          console.error('[card/ensure] encrypt migrate failed', encErr.message);
        }
      }

      const last4 =
        profile.card_last4 ||
        (plainNum ? plainNum.slice(-4) : null) ||
        '';

      if (!plainNum) {
        // Gen idantite kat (last4/hash) men pa ka dechifre — pa kreye yon lòt
        if (!unlocked) {
          return NextResponse.json({
            locked: true,
            card: last4
              ? {
                  card_number: null,
                  cvv: null,
                  exp_date: profile.exp_date,
                  card_last4: last4,
                  masked: `**** **** **** ${last4}`,
                }
              : null,
          });
        }
        return NextResponse.json(
          {
            card: last4
              ? {
                  card_number: null,
                  cvv: null,
                  exp_date: profile.exp_date,
                  card_last4: last4,
                  masked: `**** **** **** ${last4}`,
                }
              : null,
            error: 'Kat pa ka li. Kontakte sipò.',
          },
          { status: last4 ? 200 : 500 }
        );
      }

      if (!unlocked) {
        return NextResponse.json({
          locked: true,
          card: {
            card_number: null,
            cvv: null,
            exp_date: profile.exp_date,
            card_last4: last4 || plainNum.slice(-4),
            masked: maskCardNumber(plainNum),
          },
        });
      }

      if (!reveal) {
        return NextResponse.json({
          card: {
            card_number: null,
            cvv: null,
            exp_date: profile.exp_date,
            card_last4: last4 || plainNum.slice(-4),
            masked: maskCardNumber(plainNum),
          },
        });
      }

      if (!plainCvv) {
        return NextResponse.json(
          { card: null, error: 'Kat pa ka li (CVV).' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        card: await buildOwnerCardResponse(plainNum, plainCvv, profile.exp_date),
      });
    }

    // Pa gen kat nan baz
    if (!unlocked) {
      return NextResponse.json({
        locked: true,
        card: null,
        message: 'Peye frè debloke (525 HTG) pou aktive kat, terminal ak fakti.',
      });
    }

    // Sèlman si debloke epi VRÈMAN pa gen kat: kreye YON fwa (idempotan), verifye erè
    try {
      await provisionCardForUser(supabase, user.id, { activate: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Pa t kapab kreye kat.';
      console.error('[card/ensure] provision failed', message);
      return NextResponse.json({ card: null, error: message }, { status: 500 });
    }

    profile = await loadProfile();
    if (!profile || !hasStoredCard(profile)) {
      return NextResponse.json(
        { card: null, error: 'Kat pa t anrejistre. Verifye kolòn card_number (TEXT).' },
        { status: 500 }
      );
    }

    const plainNum = decryptCardField(profile.card_number);
    const plainCvv = decryptCardField(profile.cvv);
    const last4 = profile.card_last4 || (plainNum ? plainNum.slice(-4) : '');

    if (!reveal || !plainNum || !plainCvv) {
      return NextResponse.json({
        card: {
          card_number: null,
          cvv: null,
          exp_date: profile.exp_date,
          card_last4: last4,
          masked: plainNum ? maskCardNumber(plainNum) : `**** **** **** ${last4}`,
        },
      });
    }

    return NextResponse.json({
      card: await buildOwnerCardResponse(plainNum, plainCvv, profile.exp_date),
    });
  } catch (err: unknown) {
    console.error('[card/ensure]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
