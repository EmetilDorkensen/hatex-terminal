import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    // 1. INISYALIZASYON SUPABASE AK SERVICE ROLE KEY
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

    // 2. LI DONE YO
    const { transaction } = await request.json();
    
    if (!transaction) {
      return NextResponse.json({ error: 'Pa gen done tranzaksyon' }, { status: 400 });
    }

    // Validasyon minimòm
    if (!transaction.amount || !transaction.customer?.name || !transaction.customer?.phone) {
      return NextResponse.json({ error: 'Done enkonplè' }, { status: 400 });
    }

    // 3. ANREJISTRE TRANZAKSYON AN NAN BAZ DONE
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        mid: transaction.mid,
        amount: transaction.amount,
        subtotal: transaction.subtotal || transaction.amount,
        shipping_fee: transaction.shipping?.fee || 0,
        shipping_zone: transaction.shipping?.zone || 'Lokal',
        customer_name: transaction.customer.name,
        customer_phone: transaction.customer.phone,
        customer_email: transaction.customer.email || null,
        customer_address: transaction.customer.address || null,
        items: transaction.items || [],
        status: 'completed',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 4. RETOUNEN KONFIRMASYON
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook trete ak siksè',
      transaction_id: data.id 
    });

  } catch (error: any) {
    console.error('General error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Webhook endpoint API a ap mache' });
}