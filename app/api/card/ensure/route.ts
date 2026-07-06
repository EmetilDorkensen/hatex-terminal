import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { buildCardSecurityFields } from '@/lib/security/hash';

export async function POST() {
  try {
    const supabaseAuth = await createSupabaseServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Pa konekte.' }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('kyc_status, card_number, cvv, exp_date, card_number_hash')
      .eq('id', user.id)
      .single();

    if (!profile || profile.kyc_status !== 'approved') {
      return NextResponse.json({ card: null });
    }

    if (profile.card_number && profile.card_number_hash) {
      return NextResponse.json({
        card: {
          card_number: profile.card_number,
          cvv: profile.cvv,
          exp_date: profile.exp_date,
        },
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
        card_number: newCardNum,
        cvv: newCvv,
        exp_date: newExp,
        is_card_activated: true,
        ...securityFields,
      })
      .eq('id', user.id);

    return NextResponse.json({
      card: { card_number: newCardNum, cvv: newCvv, exp_date: newExp },
    });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
