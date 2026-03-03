// app/api/payments/create/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    // 1. Atann cookies yo
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) { cookieStore.set(name, value, options); },
          remove(name: string, options: any) { cookieStore.set(name, '', { ...options, maxAge: 0 }); },
        },
      }
    );

    // 2. JWENN KLE API A (nan X-API-Key oswa X-Merchant-ID)
    let apiKey = request.headers.get('X-API-Key');
    if (!apiKey) {
      apiKey = request.headers.get('X-Merchant-ID'); // pou konpatibilite
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }

    // 3. CHERCHE MACHANN NAN AK KLE API A
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('api_key', apiKey)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // 4. IDEMPOTENCY (si genyen)
    const idempotencyKey = request.headers.get('Idempotency-Key') || randomUUID();

    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existingPayment) {
      return NextResponse.json({
        paymentUrl: `/pay/${existingPayment.id}`,
        paymentId: existingPayment.id,
      });
    }

    // 5. LI DONE YO
    const body = await request.json();
    const { amount, currency, description, metadata, returnUrl } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Montan envalid' },
        { status: 400 }
      );
    }

    // 6. KREYE PEMAN AN
    const paymentId = randomUUID();

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        id: paymentId,
        merchant_id: merchant.id,
        amount,
        currency: currency || 'HTG',
        description,
        metadata: metadata || {},
        return_url: returnUrl,
        idempotency_key: idempotencyKey,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // 7. RETOUNEN LYEN AN
    return NextResponse.json({
      paymentId: payment.id,
      paymentUrl: `/pay/${payment.id}`,
    });
  } catch (error: any) {
    console.error('Payment creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}