import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { settlePendingMonCashPayments } from '@/lib/moncash/settle';
import { effectivePlan } from '@/lib/billing/plans';

export const dynamic = 'force-dynamic';

/**
 * Apre retou MonCash, kliyan an mande nou verifye peman pending li yo
 * (Alert URL ka poko rive, sitou an lokal).
 */
export async function POST() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const settled = await settlePendingMonCashPayments(admin, user.id);

  const { data: profile } = await admin
    .from('profiles')
    .select('plan, plan_status, plan_period_end, intended_plan')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    settled,
    effective_plan: effectivePlan(profile),
    plan_status: profile?.plan_status || 'none',
  });
}
