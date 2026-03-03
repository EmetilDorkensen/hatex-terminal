import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    // 1. INISYALIZASYON SUPABASE AK SERVICE ROLE KEY
    const cookieStore = await cookies(); // ✅ Atann cookies

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

    // 2. JWENN ENFO NAN HEADER
    const merchantId = request.headers.get('X-Merchant-ID');
    const apiKey = request.headers.get('X-API-Key');
    const idempotencyKey = request.headers.get('Idempotency-Key') || randomUUID();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }

    // 3. TCHÈKE SI KLE API A KÒRÈK
    // (Nou verifye pa api_key paske se sa plugin an voye)
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

    // Si yo voye merchantId, verifye li matche
    if (merchantId && merchant.id !== merchantId) {
      return NextResponse.json(
        { error: 'Merchant ID mismatch' },
        { status: 401 }
      );
    }

    // 4. VERIFYE IDEMPOTENCY (anpeche doub peman)
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

    // 5. LI DONE YO
    const body = await request.json();
    const { amount, currency, description, metadata, returnUrl } = body;

    // Validasyon minimòm
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Montan envalid' },
        { status: 400 }
      );
    }

    // 6. KREYE DOSYE PEMAN AN
    const paymentId = randomUUID();

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        id: paymentId,
        merchant_id: merchant.id, // Itilize id machann nan
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
      console.error('Insert error:', error);
      throw error;
    }

    // 7. RETOUNEN LYEN POU KLIYAN AN PEYE
    return NextResponse.json({
      paymentId: payment.id,
      paymentUrl: `/pay/${payment.id}`
    });

  } catch (error: any) {
    console.error('Payment creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}