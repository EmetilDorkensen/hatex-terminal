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

    const body = await request.json();
    const { merchantId, amount, currency, description, metadata, returnUrl } = body;

    if (!merchantId || !amount) {
      return NextResponse.json({ error: 'Done enkonplè' }, { status: 400 });
    }

    // Verifye machann nan
    const { data: merchant, error: merchantError } = await supabase
      .from('profiles')
      .select('id, kyc_status')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Machann pa jwenn' }, { status: 404 });
    }

    if (merchant.kyc_status !== 'approved') {
      return NextResponse.json({ error: 'KYC poko apwouve' }, { status: 403 });
    }

    // Kreye peman an
    const paymentId = randomUUID();
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        id: paymentId,
        merchant_id: merchantId,
        amount,
        currency: currency || 'HTG',
        description,
        metadata,
        return_url: returnUrl,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      paymentId: payment.id,
      paymentUrl: `/pay/${payment.id}`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}