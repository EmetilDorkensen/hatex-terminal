import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Fonksyon pou kreye kliyan Supabase (pou evite repetisyon)
function createSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: any) {
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );
}

// Endpoint pou abònman otomatik (deklanche pa cron)
export async function GET() {
  const supabase = createSupabaseClient();

  try {
    // 1. Chèche tout abònman ki dwe peye jodi a
    const today = new Date().toISOString().split('T')[0];

    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*, customers(*)')
      .eq('next_billing', today)
      .eq('status', 'active');

    if (subError) {
      console.error('Erè nan chèche abònman:', subError);
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    if (!subscriptions?.length) {
      return NextResponse.json({ message: 'Pa gen abònman pou jodi a' });
    }

    // 2. Pou chak abònman, eseye pran lajan an
    const results = [];

    for (const sub of subscriptions) {
      try {
        // Vérifye si kliyan an gen ase lajan (si w gen yon sistèm balans)
        // Sa depann de estrikti w; si pa genyen, sote etap sa a.
        // Ex: const { data: balance } = await supabase.from('balances').select('amount').eq('user_id', sub.customer_id).single();
        // if (!balance || balance.amount < sub.amount) throw new Error('Balans ensifizan');

        // Kreye yon ID peman inik
        const paymentId = crypto.randomUUID();

        // Kreye dosye peman an
        const { data: payment, error: payError } = await supabase
          .from('payments')
          .insert({
            id: paymentId,
            merchant_id: sub.merchant_id,
            customer_id: sub.customer_id,
            amount: sub.amount,
            currency: sub.currency || 'HTG',
            description: `Abònman ${sub.plan_name || ''}`,
            type: 'subscription',
            subscription_id: sub.id,
            status: 'processing', // ou ka mete 'processing' olye 'pending'
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (payError) throw payError;

        // --- ISIT OU TA DWE PRAN LAJAN AN NAN KONT KLIYAN AN ---
        // Egzanp si w gen yon tab 'balances':
        // await supabase.rpc('debit_balance', { user_id: sub.customer_id, amount: sub.amount });

        // Si tout bagay mache, mete ajou peman an kòm 'completed'
        await supabase
          .from('payments')
          .update({ status: 'completed' })
          .eq('id', paymentId);

        // Mete ajou abònman an (pwochen dat)
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);

        await supabase
          .from('subscriptions')
          .update({
            next_billing: nextDate.toISOString().split('T')[0],
            last_payment: new Date().toISOString()
          })
          .eq('id', sub.id);

        // Anrejistre tranzaksyon an (si w gen yon tab transactions apa)
        await supabase.from('transactions').insert({
          payment_id: paymentId,
          subscription_id: sub.id,
          amount: sub.amount,
          status: 'completed',
          created_at: new Date().toISOString()
        });

        // Voye yon webhook bay machann nan (si yo anrejistre)
        // Itilize `fetch` san `await` pou pa retade repons, oswa fè l an paralèl.
        // Nou ka itilize `Promise.allSettled` si nou vle asire yo tout voye.
        try {
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
        } catch (webhookError) {
          // Si webhook la echwe, nou ka anrejistre l pou re-eseye pita
          console.error('Webhook failed for subscription', sub.id, webhookError);
          // Opsyonèl: ajoute nan yon tab webhook_failures
        }

        results.push({ subscription: sub.id, status: 'success' });
      } catch (error: any) {
        console.error(`Subscription ${sub.id} failed:`, error);
        // Si peman an echwe, mete ajou estati abònman an (si ou vle)
        // Opsyonèl: mete yon kontè echèk, epi anile si plizyè fwa
        await supabase
          .from('subscriptions')
          .update({ status: 'failed' }) // oubyen kenbe active ak retry
          .eq('id', sub.id);

        results.push({ subscription: sub.id, status: 'failed', error: error.message });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (error: any) {
    console.error('Fatal error in charge route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}