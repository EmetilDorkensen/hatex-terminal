import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token manke' }, { status: 400 });
    }

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

    // Verifye token an
    const { data: tokenData, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('*, user_id')
      .eq('token', token)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: 'Token pa valab oswa ekspire' }, { status: 401 });
    }

    // Jwenn enfòmasyon machann nan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', tokenData.user_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Machann pa jwenn' }, { status: 404 });
    }

    // Efase token an apre itilizasyon (opsyonèl)
    await supabase.from('oauth_tokens').delete().eq('id', tokenData.id);

    // Retounen enfòmasyon yo
    return NextResponse.json({
      merchant_id: profile.id,
      business_name: profile.business_name,
      api_key: profile.api_key, // Si ou gen yon kle API
    });

  } catch (error: any) {
    console.error('Token verification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'OAuth token endpoint' });
}