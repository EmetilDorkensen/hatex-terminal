import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { verifyCronSecret } from '@/lib/security/cron-auth';
import { getAuthenticatedUser, ADMIN_EMAIL } from '@/lib/kyc/access';
import { settlePendingMonCashPayments } from '@/lib/moncash/settle';
import { monCashAlertUrl, monCashReturnUrl } from '@/lib/moncash/callbacks';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Poll peman MonCash pending si Alert URL (webhook) pa rive.
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
  const settled = await settlePendingMonCashPayments(admin);

  return NextResponse.json({
    ok: true,
    settled,
    alert_url: monCashAlertUrl(),
    return_url: monCashReturnUrl(),
  });
}

export async function POST(request: Request) {
  return GET(request);
}
