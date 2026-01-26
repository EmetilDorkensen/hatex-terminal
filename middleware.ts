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
  // Si moun nan ap itilize admin.hatexcard.com
  if (hostname.includes('admin.hatexcard.com')) {
    // Si li pa deja nan folder /admin, nou voye l la an kachèt (rewrite)
    if (!url.pathname.startsWith('/admin')) {
      url.pathname = `/admin${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // --- 2. Sekirite Aksè Admin (via Email) ---
  // Nou tcheke sa pou tout moun ki eseye wè kontni /admin lan
  if (url.pathname.startsWith('/admin')) {
    const ADMIN_EMAIL = "hatexcard@gmail.com"; 
    
    // Si pa gen sesyon oswa si se pa email ou, voye l sou login
    if (!session || session.user.email !== ADMIN_EMAIL) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response
}

export const config = {
  matcher: [
    '/',              // <--- SI LIY SA PA LA, L-AP TOUJOURS VOYE-W SOU LANDING PAGE LA
    '/dashboard/:path*', 
    '/admin/:path*',
  ],
}