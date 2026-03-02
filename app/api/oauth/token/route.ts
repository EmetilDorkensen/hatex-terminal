import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const returnUrl = cookieStore.get('hatex_oauth_return')?.value;
  const state = cookieStore.get('hatex_oauth_state')?.value;

  if (!returnUrl || !state) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  const { code, grant_type } = await request.json();

  if (grant_type !== 'authorization_code') {
    return NextResponse.json({ error: 'Invalid grant type' }, { status: 400 });
  }

  // Verifye kòd la (pou senplifye, nou sipoze kòd la se ID itilizatè a)
  // Nan pratik, ou ta dwe verifye yon nonb oza.

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: () => {} } }
  );

  // Kreye yon token aksè
  const accessToken = crypto.randomBytes(32).toString('hex');

  // Anrejistre token an pou itilizatè sa a
  await supabase.from('merchants').update({ access_token: accessToken }).eq('id', code);

  return NextResponse.json({ access_token: accessToken });
}