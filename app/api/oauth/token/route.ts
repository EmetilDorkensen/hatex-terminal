import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
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

    // 🔐 YON SÈL ITILIZASYON: nou SITIRE (delete) token an atomikman pandan n
    // ap verifye l, olye nou jis li l epi kite l valab pandan tout 1èdtan an.
    // `.delete().select()` la a garanti si 2 rekèt rive an menm tan, se sèlman
    // youn ki ka reyisi jwenn ranje a (Postgres fè operasyon an atomik).
    const { data: deletedRows, error } = await supabase
      .from('oauth_tokens')
      .delete()
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .select('user_id');

    const tokenData = deletedRows && deletedRows.length > 0 ? deletedRows[0] : null;

    if (error || !tokenData) {
      return NextResponse.json({ error: 'Token pa valab, ekspire, oswa li gentan itilize.' }, { status: 401 });
    }

    return NextResponse.json({ user_id: tokenData.user_id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}