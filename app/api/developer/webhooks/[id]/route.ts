import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { requireEligibleMerchant } from '@/lib/security/developer-auth';

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: RouteParams) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`dev-webhooks-delete:${ip}`, 20, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const auth = await requireEligibleMerchant();
  if (auth.error || !auth.supabaseAdmin || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  const { data: existing } = await auth.supabaseAdmin
    .from('developer_webhook_endpoints')
    .select('id')
    .eq('id', id)
    .eq('merchant_id', auth.profile.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Pwen webhook pa jwenn oswa li pa pou ou.' }, { status: 404 });
  }

  const { error } = await auth.supabaseAdmin
    .from('developer_webhook_endpoints')
    .delete()
    .eq('id', id)
    .eq('merchant_id', auth.profile.id);

  if (error) {
    return NextResponse.json({ error: 'Pa ka efase pwen webhook la.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
