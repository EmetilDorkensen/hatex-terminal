import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronSecret } from '@/lib/security/cron-auth';
import { sendSubscriptionPaidEmails } from '@/lib/reservations/notify-subscription';

/** Cron: renew due reservation marketplace subscriptions (card debit). */
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();
  const { data: subs, error } = await supabase
    .from('reservation_subscriptions')
    .select(
      'id, amount, billing_interval_days, buyer_id, merchant_id, listing:reservation_listings(title, description)'
    )
    .in('status', ['active', 'past_due'])
    .lte('next_billing_date', now)
    .limit(100);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  let ok = 0;
  let fail = 0;
  for (const sub of subs || []) {
    const { data } = await supabase.rpc('process_reservation_subscription_renewal', {
      p_subscription_id: sub.id,
    });
    if ((data as { success?: boolean } | null)?.success) {
      ok += 1;
      try {
        const [{ data: buyer }, { data: merchant }] = await Promise.all([
          supabase.from('profiles').select('email, full_name').eq('id', sub.buyer_id).maybeSingle(),
          supabase
            .from('profiles')
            .select('email, full_name, business_name')
            .eq('id', sub.merchant_id)
            .maybeSingle(),
        ]);
        const listing = sub.listing as { title?: string; description?: string } | null;
        await sendSubscriptionPaidEmails({
          buyerEmail: buyer?.email,
          buyerName: buyer?.full_name,
          merchantEmail: merchant?.email,
          merchantName: merchant?.business_name || merchant?.full_name,
          planTitle: listing?.title || 'Abònman',
          amount: Number(sub.amount),
          intervalDays: Number(sub.billing_interval_days || 30),
          description: listing?.description,
        });
      } catch {
        // ignore mail errors
      }
    } else {
      fail += 1;
    }
  }

  return NextResponse.json({
    success: true,
    processed: (subs || []).length,
    renewed: ok,
    failed: fail,
  });
}
