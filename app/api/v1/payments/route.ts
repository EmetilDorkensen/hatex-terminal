// app/api/v1/payments/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
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

    // 1. Jwenn kle API a nan header
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    // 2. Verifye kle API a nan tab profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, business_name')
      .eq('api_key', apiKey)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // 3. Verifye idempotency (si ou vle)
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

    // 4. Resevwa done yo
    const body = await request.json();
    const { amount, currency, description, metadata, returnUrl } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Montan envalid' },
        { status: 400 }
      );
    }

    // 5. Kreye peman an
    const paymentId = randomUUID();

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        id: paymentId,
        user_id: profile.id,
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