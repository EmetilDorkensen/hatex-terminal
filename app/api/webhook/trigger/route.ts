import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
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

    // 1. Resevwa done yo
    const { transaction } = await request.json();
    
    if (!transaction) {
      return NextResponse.json({ error: 'No transaction data' }, { status: 400 });
    }

    console.log('✅ Webhook resevwa:', transaction);

    // 2. Anrejistre tranzaksyon an
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        mid: transaction.mid,
        amount: transaction.amount,
        subtotal: transaction.subtotal,
        shipping_fee: transaction.shipping?.fee,
        shipping_zone: transaction.shipping?.zone,
        customer_name: transaction.customer?.name,
        customer_phone: transaction.customer?.phone,
        customer_email: transaction.customer?.email,
        customer_address: transaction.customer?.address,
        items: transaction.items,
        status: 'completed',
        created_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('❌ Erè nan anrejistreman:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. (Opsyonèl) Voye notifikasyon bay machann nan via webhooks
    // ... (ou ka ajoute lojik pou sa)

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook trete ak siksè',
      transaction_id: data?.[0]?.id 
    });

  } catch (error: any) {
    console.error('❌ Erè jeneral:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Webhook endpoint API a ap mache' });
}