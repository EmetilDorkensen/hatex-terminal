import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Sèvi ak Service Role pou gen dwa ekri
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // MonCash voye userId la nan "custom"
    const userId = body.custom; 
    const amountPaid = parseFloat(body.amount);

    if (body.transaction_id) {
      // 1. Mete tranzaksyon an nan tablo 'deposits'
      const { error: depError } = await supabase.from('deposits').insert([{
        user_id: userId,
        amount: amountPaid,
        method: 'MonCash',
        status: 'completed',
        transaction_id: body.transaction_id
      }]);

      if (depError) throw depError;

      // 2. Mizajou Balans lan nan tablo 'profiles'
      // N ap ajoute montant an sou sa k te la deja
      const { data: profile } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

      const newBalance = (profile?.balance || 0) + amountPaid;

      const { error: profError } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', userId);

      if (profError) throw profError;
    }

    return NextResponse.json({ status: 'success' });
  } catch (err: any) {
    console.error("Webhook Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}