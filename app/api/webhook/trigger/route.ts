import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inisyalize Supabase ak sèvis backend
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Sa a se kle ki an sekirite (backend sèlman)
);

export async function POST(request: Request) {
  try {
    // 1. Resevwa done yo
    const { transaction } = await request.json();
    
    if (!transaction) {
      return NextResponse.json({ error: 'No transaction data' }, { status: 400 });
    }

    console.log('✅ Webhook resevwa:', transaction);

    // 2. Anrejistre tranzaksyon an nan baz done (si ou vle)
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

    // 3. Ou ka voye imèl, SMS, elatriye isit
    // (ou deja genyen api/send-email)

    // 4. Retounen yon siksè
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

// Opsyonèl: pou verifye ke route la mache (GET)
export async function GET() {
  return NextResponse.json({ message: 'Webhook endpoint API a ap mache' });
}