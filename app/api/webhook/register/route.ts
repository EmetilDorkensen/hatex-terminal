import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

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

    // 2. JWENN TOKEN NAN HEADER
    const { url, events } = await request.json();
    const token = request.headers.get('authorization')?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Pa gen token' }, { status: 401 });
    }

    // 3. VERIFYE ITILIZATÈ A AK TOKEN AN
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Token pa valab' }, { status: 401 });
    }

    // 4. VALIDATE URL LA
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL pa valab' }, { status: 400 });
    }

    // 5. VALIDATE EVÈNMAN YO (dwe yon array)
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Events dwe yon array ki pa vid' }, { status: 400 });
    }

    // 6. JENERE YON SEKRÈ INIK POU SIYATI
    const secret = crypto.randomBytes(32).toString('hex');

    // 7. ANREJISTRE NAN BAZ DONE
    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        user_id: user.id,
        url,
        events,
        secret,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ webhook: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}