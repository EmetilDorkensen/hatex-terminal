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
  if (hostname.includes('admin.hatexcard.com')) {
    if (!url.pathname.startsWith('/admin')) {
      url.pathname = `/admin${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // --- 2. Sekirite Aksè Admin (via Email) ---
  if (url.pathname.startsWith('/admin')) {
    const ADMIN_EMAIL = "hatexcard@gmail.com"; 
    
    if (!session || session.user.email !== ADMIN_EMAIL) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Sekirite Dashboard: Si moun nan ap eseye ale nan dashboard san li pa konekte
  if (url.pathname.startsWith('/dashboard') && !session) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match tout rout yo eksepte fichye estatik yo (pwa, images, etsetera)
     * Sa a pèmèt Middleware la toujou tcheke si moun nan konekte pou l ka afiche balans lan.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}