import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    // 1. Verifye idantite machann nan (JWT token)
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

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

    // Verifye idantite ak JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Resevwa done yo
    const body = await request.json();
    const { url, events } = body;

    if (!url || !events) {
      return NextResponse.json({ error: 'Missing url or events' }, { status: 400 });
    }

    // 3. Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // 4. Validate events (dwe yon array ki pa vid)
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Events must be a non-empty array' }, { status: 400 });
    }

    // 5. Jenere yon sekrè inik
    const secret = crypto.randomBytes(32).toString('hex');

    // 6. Anrejistre webhook la
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

    // 7. Retounen siksè
    return NextResponse.json({ webhook: data });

  } catch (error: any) {
    console.error('Webhook registration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}