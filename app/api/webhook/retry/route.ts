import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient(
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

  // 1. Chèche failures ki prè pou retry
  const now = new Date().toISOString();
  const { data: failures, error } = await supabase
    .from('webhook_failures')
    .select('*, webhooks(*)')
    .lte('next_retry_at', now)
    .lt('retry_count', 5); // Pa eseye plis pase 5 fwa

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const fail of failures || []) {
    const webhook = fail.webhooks;
    if (!webhook) continue;

    // Rekipere detay tranzaksyon an (ou dwe gen yon tab transactions)
    const { data: tx } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', fail.transaction_id)
      .single();

    if (!tx) continue;

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
        // Si mache, efase failure a
        await supabase.from('webhook_failures').delete().eq('id', fail.id);
      } else {
        // Si pa mache, mete ajou retry_count ak next_retry_at (backoff eksponansyèl)
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

  return NextResponse.json({ processed: failures?.length || 0 });
}