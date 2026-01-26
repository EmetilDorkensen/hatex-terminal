import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  // --- 1. Jesyon Sou-domèn admin.hatexcard.com ---
  // Nou netwaye hostname lan pou evite konfizyon ak "www" oswa "pò"
  const isAdminSubdomain = hostname.startsWith('admin.');

  if (isAdminSubdomain) {
    // Si li tape admin.hatexcard.com, nou fòse li wè kontni ki nan folder /admin
    if (!url.pathname.startsWith('/admin')) {
      url.pathname = `/admin${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // --- 2. Sekirite Aksè Admin (via Email) ---
  // Sa ap pwoteje paj la menm si moun nan tape hatexcard.com/admin
  if (url.pathname.startsWith('/admin')) {
    const ADMIN_EMAIL = "hatexcard@gmail.com"; 
    
    if (!session || session.user.email !== ADMIN_EMAIL) {
      // Si se pa admin nan, nou voye l sou login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response
}

export const config = {
  // Nou mete matcher a pou l tcheke tout paj ki kòmanse ak /dashboard oswa /admin
  matcher: [
    '/dashboard/:path*', 
    '/admin/:path*',
  ],
}