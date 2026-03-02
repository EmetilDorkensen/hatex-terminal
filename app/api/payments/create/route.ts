import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // 1. Verifye machann nan
    const merchantId = request.headers.get('X-Merchant-ID');
    const apiKey = request.headers.get('X-API-Key');
    const idempotencyKey = request.headers.get('Idempotency-Key') || randomUUID();

    if (!merchantId || !apiKey) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 401 });
    }

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

    // 3. Verifye idempotency (anpeche doub peman)
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existingPayment) {
      // Si deja egziste, retounen menm sesyon an
      return NextResponse.json({ 
        paymentUrl: `/pay/${existingPayment.id}`,
        paymentId: existingPayment.id 
      });
    }

    // 4. Resewva done yo
    const body = await request.json();
    const { amount, currency, description, metadata, returnUrl } = body;

    // 5. Kreye yon ID inik pou peman an
    const paymentId = randomUUID();

    // 6. Anrejistre peman an nan baz done
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

    // 7. Retounen lyen peman an
    return NextResponse.json({
      paymentId: payment.id,
      paymentUrl: `/pay/${payment.id}`
    });

  } catch (error: any) {
    console.error('Payment creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}