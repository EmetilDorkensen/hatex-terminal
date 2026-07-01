import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_EMAIL = 'hatexcard@gmail.com';
const STAFF_ROLES = ['support', 'finance', 'compliance'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  if (hostname.includes('admin.hatexcard.com')) {
    if (!url.pathname.startsWith('/admin')) {
      url.pathname = `/admin${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (url.pathname.startsWith('/admin')) {
    if (!session || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (url.pathname.startsWith('/workspace')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!profile || !STAFF_ROLES.includes(profile.role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  if (url.pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
