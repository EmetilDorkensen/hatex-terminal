import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { verifyCronSecret } from '@/lib/security/cron-auth';
import { getAuthenticatedUser, ADMIN_EMAIL } from '@/lib/kyc/access';
import { processPendingPayouts } from '@/lib/payouts/execute';
import { PLANS } from '@/lib/billing/plans';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron: reeseye payout MonCash, make pèdi apre 10 jou, ekpire abonnman.
 */
export async function GET(request: Request) {
  const cronOk = verifyCronSecret(request);
  if (!cronOk) {
    const { user } = await getAuthenticatedUser();
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const admin = createSupabaseAdminClient();
  const payouts = await processPendingPayouts(admin);

  const now = new Date().toISOString();
  const { data: expired } = await admin
    .from('profiles')
    .select('id, plan')
    .eq('plan_status', 'active')
    .in('plan', ['capacity', 'premium'])
    .lt('plan_period_end', now)
    .limit(100);

  let expiredPlans = 0;
  for (const row of expired || []) {
    await admin
      .from('profiles')
      .update({
        plan_status: 'expired',
        plan: 'free',
        intended_plan: row.plan,
      })
      .eq('id', row.id);

    await admin.from('hatex_notifications').insert({
      user_id: row.id,
      kind: 'plan_expired',
      title: 'Abonnman fini',
      body:
        `Plan ${PLANS[(row.plan as 'capacity' | 'premium') || 'capacity']?.name || row.plan} ou a fini. ` +
        'Ou tounen sou plan Gratis (25 000 HTG/jou). Peye ankò pou elaji kont ou.',
      href: '/plan',
    });
    expiredPlans += 1;
  }

  return NextResponse.json({
    ok: true,
    at: now,
    payouts,
    expired_plans: expiredPlans,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
