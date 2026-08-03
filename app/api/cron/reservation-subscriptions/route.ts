import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronSecret } from '@/lib/security/cron-auth';
import {
  sendSubscriptionPaidEmails,
  sendSubscriptionLowBalanceWarningEmails,
  sendSubscriptionNonRenewalMerchantEmail,
} from '@/lib/reservations/notify-subscription';

/** Cron: renew due subs + low-balance warnings (2d before) + non-renewal notices (2d after). */
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const nowIso = now.toISOString();
  const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

  let renewed = 0;
  let failed = 0;
  let lowBalanceWarned = 0;
  let nonRenewalNotices = 0;

  // ---------- 1) Renouvèlman ki dwe kounye a ----------
  const { data: dueSubs, error: dueErr } = await supabase
    .from('reservation_subscriptions')
    .select(
      'id, amount, billing_interval_days, buyer_id, merchant_id, listing:reservation_listings(title, description)'
    )
    .in('status', ['active', 'past_due'])
    .lte('next_billing_date', nowIso)
    .limit(100);

  if (dueErr) {
    return NextResponse.json({ success: false, message: dueErr.message }, { status: 500 });
  }

  for (const sub of dueSubs || []) {
    const { data } = await supabase.rpc('process_reservation_subscription_renewal', {
      p_subscription_id: sub.id,
    });
    if ((data as { success?: boolean } | null)?.success) {
      renewed += 1;
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
        /* ignore */
      }
    } else {
      failed += 1;
    }
  }

  // ---------- 2) 2 jou alavans: kat pa gen ase kob ----------
  const { data: upcoming } = await supabase
    .from('reservation_subscriptions')
    .select(
      'id, amount, next_billing_date, buyer_id, merchant_id, listing:reservation_listings(title)'
    )
    .eq('status', 'active')
    .gt('next_billing_date', nowIso)
    .lte('next_billing_date', inTwoDays)
    .is('low_balance_warning_sent_at', null)
    .limit(100);

  for (const sub of upcoming || []) {
    const { data: buyer } = await supabase
      .from('profiles')
      .select('email, full_name, card_balance')
      .eq('id', sub.buyer_id)
      .maybeSingle();

    if (!buyer || Number(buyer.card_balance || 0) >= Number(sub.amount)) continue;

    const { data: merchant } = await supabase
      .from('profiles')
      .select('email, full_name, business_name')
      .eq('id', sub.merchant_id)
      .maybeSingle();

    const listing = sub.listing as { title?: string } | null;
    try {
      await sendSubscriptionLowBalanceWarningEmails({
        buyerEmail: buyer.email,
        buyerName: buyer.full_name,
        merchantEmail: merchant?.email,
        merchantName: merchant?.business_name || merchant?.full_name,
        planTitle: listing?.title || 'Abònman',
        amount: Number(sub.amount),
        nextBillingDate: sub.next_billing_date,
        cardBalance: Number(buyer.card_balance || 0),
      });
      await supabase
        .from('reservation_subscriptions')
        .update({ low_balance_warning_sent_at: nowIso, updated_at: nowIso })
        .eq('id', sub.id);
      lowBalanceWarned += 1;
    } catch {
      /* ignore */
    }
  }

  // ---------- 3) 2 jou apre: pa renouvle → imèl machann ----------
  const { data: overdue } = await supabase
    .from('reservation_subscriptions')
    .select(
      'id, amount, status, next_billing_date, buyer_id, merchant_id, listing:reservation_listings(title)'
    )
    .in('status', ['past_due', 'cancelled'])
    .lte('next_billing_date', twoDaysAgo)
    .is('non_renewal_notice_sent_at', null)
    .limit(100);

  for (const sub of overdue || []) {
    const [{ data: buyer }, { data: merchant }] = await Promise.all([
      supabase.from('profiles').select('email, full_name').eq('id', sub.buyer_id).maybeSingle(),
      supabase
        .from('profiles')
        .select('email, full_name, business_name')
        .eq('id', sub.merchant_id)
        .maybeSingle(),
    ]);
    const listing = sub.listing as { title?: string } | null;
    try {
      await sendSubscriptionNonRenewalMerchantEmail({
        merchantEmail: merchant?.email,
        merchantName: merchant?.business_name || merchant?.full_name,
        buyerName: buyer?.full_name,
        buyerEmail: buyer?.email,
        planTitle: listing?.title || 'Abònman',
        amount: Number(sub.amount),
        nextBillingDate: sub.next_billing_date,
        status: sub.status,
      });
      await supabase
        .from('reservation_subscriptions')
        .update({ non_renewal_notice_sent_at: nowIso, updated_at: nowIso })
        .eq('id', sub.id);
      nonRenewalNotices += 1;
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({
    success: true,
    renewed,
    failed,
    low_balance_warned: lowBalanceWarned,
    non_renewal_notices: nonRenewalNotices,
    due_checked: (dueSubs || []).length,
  });
}
