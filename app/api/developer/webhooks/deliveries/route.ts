import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { requireEligibleMerchant } from '@/lib/security/developer-auth';

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`dev-webhooks-deliveries:${ip}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const auth = await requireEligibleMerchant();
  if (auth.error || !auth.supabaseAdmin || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: deliveries, error } = await auth.supabaseAdmin
    .from('developer_webhook_deliveries')
    .select('id, endpoint_id, event_type, response_status, success, attempt_count, created_at, delivered_at')
    .eq('merchant_id', auth.profile.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: 'Pa ka chaje istorik delivrans yo.' }, { status: 500 });
  }

  return NextResponse.json({ deliveries: deliveries || [] });
}
