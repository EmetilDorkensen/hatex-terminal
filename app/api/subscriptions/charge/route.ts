import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: Request) {
  try {
    // 1. VERIFIKASYON SEKIRITE (CRON SECRET)
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Ou pa gen otorizasyon' }, { status: 401 });
    }

    // 2. INISYALIZASYON SUPABASE AK SERVICE ROLE KEY
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Itilize service role key pou modifye done san itilizatè
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) { cookieStore.set(name, value, options); },
          remove(name: string, options: any) { cookieStore.set(name, '', { ...options, maxAge: 0 }); },
        },
      }
    );

    // 3. JWENN ABÒNMAN AKTYÈL YO (next_billing = jodi a)
    const today = new Date().toISOString().split('T')[0];
    
    const { data: subscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*, customers(*)')
      .eq('next_billing', today)
      .eq('status', 'active');

    if (fetchError) throw fetchError;
    if (!subscriptions?.length) {
      return NextResponse.json({ message: 'Pa gen abònman pou trete jodi a' });
    }

    // 4. TRETMAN AN PARALÈL
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const paymentId = crypto.randomUUID();
        
        // Kreye dosye peman an
        const { error: pError } = await supabase
          .from('payments')
          .insert({
            id: paymentId,
            merchant_id: sub.merchant_id,
            customer_id: sub.customer_id,
            amount: sub.amount,
            currency: sub.currency,
            description: `Renouvèlman abònman: ${sub.plan_name}`,
            type: 'subscription',
            subscription_id: sub.id,
            status: 'completed', // Sipoze peman an fèt avèk siksè
            created_at: new Date().toISOString()
          });

        if (pError) throw new Error(`Peman echwe: ${pError.message}`);

        // Kalkile pwochen dat
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);
        const nextBillingStr = nextDate.toISOString().split('T')[0];

        // Mete ajou abònman an
        await supabase
          .from('subscriptions')
          .update({
            next_billing: nextBillingStr,
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

        // Voye notifikasyon (pa oblije tann)
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'subscription.renewed',
            subscription_id: sub.id,
            payment_id: paymentId,
            customer: sub.customers
          })
        }).catch(err => console.error("Webhook Error:", err));

        return { id: sub.id, status: 'success' };
      })
    );

    // 5. REZIME REZILTA YO
    const summary = {
      total: subscriptions.length,
      success: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
    };

    return NextResponse.json({ message: 'Tretman fini', summary });

  } catch (error: any) {
    console.error('Fatal Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}