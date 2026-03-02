import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: Request) {
  try {
    // 1. VERIFIKASYON SEKIRITE (CRON SECRET) – si ou vle itilize li
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. INISYALIZASYON SUPABASE
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) { cookieStore.set(name, value, options); },
          remove(name: string, options: any) { cookieStore.set(name, '', { ...options, maxAge: 0 }); },
        },
      }
    );

    // 3. JWENN FAILURES KI PRÈ POU RE-ESEYE
    const { data: failures, error } = await supabase
      .from('webhook_failures')
      .select('*, webhooks(*)')
      .lte('next_retry_at', new Date().toISOString())
      .lt('retry_count', 5); // Pa eseye plis pase 5 fwa

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 4. POU CHAK FAILURE, RE-ESEYE VOYE
    for (const fail of failures) {
      const webhook = fail.webhooks;
      if (!webhook) continue;

      // Rekipere detay tranzaksyon an (sipoze ou gen yon tab 'transactions')
      const { data: tx } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', fail.transaction_id)
        .single();

      if (!tx) continue;

      // Konstwi payload la menm jan ak lè w te voye a
      const payload = {
        event: 'payment.succeeded',
        transaction_id: tx.id,
        amount: tx.amount,
        currency: tx.currency || 'HTG',
        customer: tx.customer,
        items: tx.items,
        shipping: tx.shipping,
        timestamp: new Date().toISOString(),
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(payloadString)
        .digest('hex');

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hatex-Signature': signature,
            'X-Hatex-Idempotency-Key': tx.id,
          },
          body: payloadString,
        });

        if (response.ok) {
          // Si siksè, efase failure a
          await supabase.from('webhook_failures').delete().eq('id', fail.id);
        } else {
          // Si echwe ankò, planifye pwochen tantativ
          const nextRetry = new Date();
          nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, fail.retry_count + 1));
          await supabase
            .from('webhook_failures')
            .update({
              retry_count: fail.retry_count + 1,
              next_retry_at: nextRetry.toISOString(),
            })
            .eq('id', fail.id);
        }
      } catch (err: any) {
        // Si gen erè rezo, mete ajou tou
        const nextRetry = new Date();
        nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, fail.retry_count + 1));
        await supabase
          .from('webhook_failures')
          .update({
            retry_count: fail.retry_count + 1,
            next_retry_at: nextRetry.toISOString(),
          })
          .eq('id', fail.id);
      }
    }

    return NextResponse.json({ processed: failures.length });

  } catch (error: any) {
    console.error('Retry error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}