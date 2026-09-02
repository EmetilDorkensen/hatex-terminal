import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { fetchMerchantHistory } from '@/lib/history/merchant-history';

export const dynamic = 'force-dynamic';

/** Istorik machann: hatex_payments + payouts + abonnman. */
export async function GET(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated' } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(120, Math.max(1, Number(searchParams.get('limit') || 80)));

  const admin = createSupabaseAdminClient();
  const transactions = await fetchMerchantHistory(admin, user.id, limit);

  return NextResponse.json({ transactions });
}
