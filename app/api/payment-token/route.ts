import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        },
      }
    );

    // Verifye otantifikasyon an
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });
    }

    // Chache yon token ki pa ekspire pou machann sa a
    const { data: existing } = await supabase
      .from('payment_tokens')
      .select('id')
      .eq('merchant_id', user.id)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ token: existing.id });
    }

    // Kreye yon nouvo token
    const token = randomBytes(16).toString('hex'); // 32 karaktè
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 jou

    const { error: insertError } = await supabase
      .from('payment_tokens')
      .insert({
        id: token,
        merchant_id: user.id,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error creating token:', insertError);
      return NextResponse.json({ error: 'Pa ka kreye token' }, { status: 500 });
    }

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Payment token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}