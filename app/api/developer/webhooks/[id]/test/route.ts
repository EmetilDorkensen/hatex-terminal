import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { requireEligibleMerchant } from '@/lib/security/developer-auth';
import { sendTestWebhook } from '@/lib/security/webhook-delivery';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`dev-webhooks-test:${ip}`, 15, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const auth = await requireEligibleMerchant();
  if (auth.error || !auth.supabaseAdmin || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  const { data: endpoint, error } = await auth.supabaseAdmin
    .from('developer_webhook_endpoints')
    .select('id, merchant_id, url, secret, events, is_active')
    .eq('id', id)
    .eq('merchant_id', auth.profile.id)
    .single();

  if (error || !endpoint) {
    return NextResponse.json({ error: 'Pwen webhook pa jwenn oswa li pa pou ou.' }, { status: 404 });
  }

  if (!endpoint.is_active) {
    return NextResponse.json({ error: 'Pwen webhook sa a pa aktif.' }, { status: 400 });
  }

  const result = await sendTestWebhook(auth.supabaseAdmin, endpoint);

  return NextResponse.json({
    success: result.success,
    response_status: result.response_status,
    error: result.success ? undefined : 'Sèvè w la pa reponn ak yon kòd 2xx.',
  });
}
