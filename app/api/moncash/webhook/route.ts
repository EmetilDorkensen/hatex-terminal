import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Nou kreye koneksyon ak Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Sèvi ak Service Role pou gen dwa ekri
);

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log("Data MonCash voye:", data);

    // Si peman an reyisi
    if (data.status === 'successful') {
      const amount = data.amount;
      const userId = data.reference; // ID itilizatè a nou te voye nan CreatePayment

      // Nou rele fonksyon SQL la pou ajoute kòb la
      const { error } = await supabase.rpc('increment_wallet_balance', {
        user_id: userId,
        amount_to_add: amount
      });

      if (error) throw error;

      // Nou ka ajoute yon liy nan istorik tranzaksyon an tou isit la
    }

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error("Webhook Error:", err);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 400 });
  }
}