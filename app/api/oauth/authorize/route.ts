import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const returnUrl = searchParams.get('return_url');
  const siteUrl = searchParams.get('site_url');
  const state = searchParams.get('state');

  if (!returnUrl || !siteUrl || !state) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // Depoze enfòmasyon yo nan yon sesyon pou itilize apre koneksyon
  const cookieStore = await cookies();
  cookieStore.set('hatex_oauth_return', returnUrl, { httpOnly: true, secure: true, maxAge: 600 });
  cookieStore.set('hatex_oauth_state', state, { httpOnly: true, secure: true, maxAge: 600 });

  // Redireksyon kliyan an nan paj koneksyon an
  return NextResponse.redirect(new URL('/login', request.url));
}