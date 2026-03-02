import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: () => {} } }
  );

  // Verifye token an
  const { data: merchant } = await supabase
    .from('merchants')
    .select('*')
    .eq('access_token', token)
    .single();

  if (!merchant) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await request.json();
  const { order_id, amount, currency, description, return_url, webhook_url } = body;

  const paymentId = randomUUID();


// Apre verifyasyon peman an
const { error: balanceError } = await supabase.rpc('increment_merchant_balance', {
    merchant_id: payload.merchant_id,
    amount_to_add: payload.amount,
  });
  
  if (balanceError) {
    console.error('Balance update failed:', balanceError);
    // Pa bloke peman an, men anrejistre erè a
  }

  // Anrejistre peman an
  await supabase.from('payments').insert({
    id: paymentId,
    merchant_id: merchant.id,
    order_id,
    amount,
    currency,
    description,
    status: 'pending',
    webhook_url,
    created_at: new Date().toISOString(),
  });

  // Retounen URL pou kliyan an peye
  const paymentUrl = `https://hatexcard.com/pay/${paymentId}`;

  return NextResponse.json({ payment_url: paymentUrl });
}