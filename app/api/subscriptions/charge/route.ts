import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Sa a dwe deklanche pa cron chak jou (eg: nan Vercel Cron Jobs)
export async function GET() {
  try {
    // 1. Chèche tout abònman ki dwe peye jodi a
    const today = new Date().toISOString().split('T')[0];
    
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('*, customers(*)')
      .eq('next_billing', today)
      .eq('status', 'active');

    if (!subscriptions?.length) {
      return NextResponse.json({ message: 'Pa gen abònman pou jodi a' });
    }

    // 2. Pou chak abònman, pran lajan an
    const results = [];
    for (const sub of subscriptions) {
      try {
        // Kreye yon peman
        const paymentId = crypto.randomUUID();
        
        const { data: payment, error } = await supabase
          .from('payments')
          .insert({
            id: paymentId,
            merchant_id: sub.merchant_id,
            customer_id: sub.customer_id,
            amount: sub.amount,
            currency: sub.currency,
            description: `Abònman ${sub.plan_name}`,
            type: 'subscription',
            subscription_id: sub.id,
            status: 'pending',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        // Isit ou ta dwe pran lajan an nan kont kliyan an
        // (sa mande yon sistèm balans)

        // Si siksè, mete ajou abònman an
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);
        
        await supabase
          .from('subscriptions')
          .update({
            next_billing: nextDate.toISOString().split('T')[0],
            last_payment: new Date().toISOString()
          })
          .eq('id', sub.id);

        // Anrejistre tranzaksyon an
        await supabase.from('transactions').insert({
          payment_id: paymentId,
          subscription_id: sub.id,
          amount: sub.amount,
          status: 'completed'
        });

        // Voye yon webhook bay machann nan
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'subscription.renewed',
            subscription_id: sub.id,
            payment_id: paymentId,
            amount: sub.amount,
            customer: sub.customers
          })
        });

        results.push({ subscription: sub.id, status: 'success' });
      } catch (error) {
        console.error(`Subscription ${sub.id} failed:`, error);
        results.push({ subscription: sub.id, status: 'failed', error: String(error) });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}