import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import {
  FRAUD_DISPUTE_LIMIT,
  listMerchantDisputes,
} from '@/lib/gateway/disputes';

export const dynamic = 'force-dynamic';

/**
 * Panèl machann — lis litij (rapò kliyan) sou peman machann nan.
 * Kont machann nan toujou verifye pa sesyon an (pa gen ID soti nan URL).
 */
export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  // Sèlman machann yo (profiles.is_merchant) ka wè litij yo
  const { data: profile } = await admin
    .from('profiles')
    .select('is_merchant, account_status')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.is_merchant !== true) {
    return NextResponse.json({ error: { code: 'not_merchant' } }, { status: 403 });
  }

  const [openDisputes, history] = await Promise.all([
    listMerchantDisputes(admin, user.id, true),
    listMerchantDisputes(admin, user.id, false),
  ]);

  const openCount = openDisputes.length;
  const resolvedCount = history.length - openCount;

  return NextResponse.json({
    disputes: history,
    open_count: openCount,
    resolved_count: resolvedCount,
    limit: FRAUD_DISPUTE_LIMIT,
    at_risk: openCount >= FRAUD_DISPUTE_LIMIT,
    account_status: profile.account_status || 'active',
    notice:
      openCount >= FRAUD_DISPUTE_LIMIT
        ? 'Kont ou te sispann otomatikman akòz plizyè rapò kliyan. Kontakte sipò pou revizyon.'
        : undefined,
  });
}
