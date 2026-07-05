import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { requireEligibleMerchant } from '@/lib/security/developer-auth';
import { ALLOWED_WEBHOOK_EVENTS, generateWebhookSecret, isSafeWebhookUrl } from '@/lib/security/webhook-delivery';

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`dev-webhooks-list:${ip}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const auth = await requireEligibleMerchant();
  if (auth.error || !auth.supabaseAdmin || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: endpoints, error } = await auth.supabaseAdmin
    .from('developer_webhook_endpoints')
    .select('id, url, events, is_active, description, created_at, updated_at')
    .eq('merchant_id', auth.profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Pa ka chaje pwen webhook yo.' }, { status: 500 });
  }

  return NextResponse.json({ endpoints: endpoints || [] });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`dev-webhooks-create:${ip}`, 20, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const auth = await requireEligibleMerchant();
  if (auth.error || !auth.supabaseAdmin || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const { url, description, events } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL obligatwa.' }, { status: 400 });
  }

  const urlCheck = isSafeWebhookUrl(url.trim());
  if (!urlCheck.safe) {
    return NextResponse.json({ error: urlCheck.reason || 'URL pa valab.' }, { status: 400 });
  }

  const eventList: string[] = Array.isArray(events) && events.length > 0
    ? events.filter((e: string) => (ALLOWED_WEBHOOK_EVENTS as readonly string[]).includes(e))
    : ['payment.success'];

  if (eventList.length === 0) {
    return NextResponse.json({ error: 'Evènman pa valab.' }, { status: 400 });
  }

  const secret = generateWebhookSecret();

  const { data: endpoint, error } = await auth.supabaseAdmin
    .from('developer_webhook_endpoints')
    .insert({
      merchant_id: auth.profile.id,
      url: url.trim(),
      secret,
      events: eventList,
      description: description?.trim() || null,
      is_active: true,
    })
    .select('id, url, events, is_active, description, created_at')
    .single();

  if (error || !endpoint) {
    return NextResponse.json({ error: 'Pa ka kreye pwen webhook la.' }, { status: 500 });
  }

  // Secret la retounen YON SÈL FWA — pa janm montre l ankò nan lis la.
  return NextResponse.json({ endpoint, secret }, { status: 201 });
}
