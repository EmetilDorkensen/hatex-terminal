import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    // 1. Atann cookieStore a paske cookies() retounen yon Promise
    const cookieStore = await cookies();
    
    // 2. Inisyalize supabase ak konfigirasyon cookies ki kòrèk
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set(name, value, options);
            } catch (error) {
              // Si gen erè nan server component, ignore
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 });
            } catch (error) {
              // Ignore
            }
          },
        },
      }
    );

    // 3. Verifye idantite machann nan
    const merchantId = request.headers.get('X-Merchant-ID');
    const apiKey = request.headers.get('X-API-Key');
    const idempotencyKey = request.headers.get('Idempotency-Key') || randomUUID();

    if (!merchantId || !apiKey) {
      return NextResponse.json(
        { error: 'Missing credentials' },
        { status: 401 }
      );
    }

    // 4. Tcheke si kle API a kòrèk - nou verifye pa api_key
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('api_key', apiKey)  // Sèvi ak api_key pou jwenn machann nan
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Opsyonèl: verifye si merchantId matche ak merchant.id
    if (merchant.id !== merchantId) {
      return NextResponse.json(
        { error: 'Merchant ID mismatch' },
        { status: 401 }
      );
    }

    // 5. Verifye idempotency (anpeche doub peman)
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

    // 6. Li done yo
    const body = await request.json();
    const { amount, currency, description, metadata, returnUrl } = body;

    // Validasyon minimòm
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Montan envalid' },
        { status: 400 }
      );
    }

    // 7. Kreye dosye peman an
    const paymentId = randomUUID();

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        id: paymentId,
        merchant_id: merchant.id,  // Sèvi ak merchant.id ki soti nan baz done
        amount,
        currency: currency || 'HTG',
        description,
        metadata: metadata || {},
        return_url: returnUrl,
        idempotency_key: idempotencyKey,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    // 8. Retounen lyen pou kliyan an peye
    return NextResponse.json({
      paymentId: payment.id,
      paymentUrl: `/pay/${payment.id}`
    });

  } catch (error: any) {
    console.error('Payment creation error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}