import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { requireEligibleMerchant } from '@/lib/security/developer-auth';
import { generateWebhookSecret } from '@/lib/security/webhook-delivery';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`dev-webhooks-rotate:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const auth = await requireEligibleMerchant();
  if (auth.error || !auth.supabaseAdmin || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const newSecret = generateWebhookSecret();

  const { data: endpoint, error } = await auth.supabaseAdmin
    .from('developer_webhook_endpoints')
    .update({ secret: newSecret, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('merchant_id', auth.profile.id)
    .select('id, url')
    .single();

  if (error || !endpoint) {
    return NextResponse.json({ error: 'Pwen webhook pa jwenn oswa li pa pou ou.' }, { status: 404 });
  }

  // Nouvo secret la retounen YON SÈL FWA.
  return NextResponse.json({ success: true, secret: newSecret, endpoint });
}
