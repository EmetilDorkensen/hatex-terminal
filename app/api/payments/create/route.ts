import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    // 1. Verifye machann nan
    const merchantId = request.headers.get('X-Merchant-ID');
    const apiKey = request.headers.get('X-API-Key');
    const idempotencyKey = request.headers.get('Idempotency-Key') || randomUUID();

    if (!merchantId || !apiKey) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 401 });
    }

    // Await cookies() paske li retounen yon Promise nan Next.js 15+
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set(name, value, options);
          },
          remove(name: string, options: any) {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          },
        },
      }
    );

    // 2. Verifye kle API a
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', merchantId)
      .eq('api_key', apiKey)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // 3. Verifye idempotency
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existingPayment) {
      return NextResponse.json({ 
        paymentUrl: `/pay/${existingPayment.id}`,
        paymentId: existingPayment.id 
      });
    }

    // 4. Resevwa done yo
    const body = await request.json();
    const { amount, currency, description, metadata, returnUrl } = body;

    // 5. Kreye yon ID inik
    const paymentId = randomUUID();

    // 6. Anrejistre peman an
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        id: paymentId,
        merchant_id: merchantId,
        amount,
        currency,
        description,
        metadata,
        return_url: returnUrl,
        idempotency_key: idempotencyKey,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // 7. Retounen lyen an
    return NextResponse.json({
      paymentId: payment.id,
      paymentUrl: `/pay/${payment.id}`
    });

  } catch (error: any) {
    console.error('Payment creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}