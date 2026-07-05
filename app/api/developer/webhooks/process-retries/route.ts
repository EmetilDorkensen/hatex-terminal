import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { processWebhookRetries } from '@/lib/security/webhook-delivery';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const processed = await processWebhookRetries(supabase);
    return NextResponse.json({ processed });
  } catch (error: any) {
    console.error('[WEBHOOK RETRY CRON]', error);
    return NextResponse.json({ error: error.message || 'Erè sèvè.' }, { status: 500 });
  }
}
