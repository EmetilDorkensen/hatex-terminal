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
  const url = request.nextUrl;
  const hostname = request.headers.get('host');

  // --- 1. Jesyon Sou-domèn admin.hatexcard.com ---
  if (hostname === 'admin.hatexcard.com') {
    if (!url.pathname.startsWith('/admin')) {
      return NextResponse.rewrite(new URL(`/admin${url.pathname}`, request.url));
    }
  }

  // --- 2. Sekirite Aksè Admin (via Email) ---
  if (url.pathname.startsWith('/admin')) {
    const ADMIN_EMAIL = "hatexcard@gmail.com"; 
    if (!session || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}