import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { WORKSPACE_GATE_COOKIE, verifyWorkspaceGateToken } from '@/lib/security/workspace-gate';
import { SESSION_TAG_COOKIE } from '@/lib/security/session-tag';

const ADMIN_EMAIL = 'adminhatexcard@gmail.com';

const PROTECTED_WALLET_PREFIXES = [
  '/deposit',
  '/withdraw',
  '/transfert',
  '/kat',
  '/kyc',
  '/terminal',
  '/invoice',
  '/agent',
  '/enterprise',
  '/setting',
];

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

  // getUser() verifye JWT kont Auth API — pi solid pase getSession() (cache lokal)
  const { data: { user } } = await supabase.auth.getUser();
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  if (hostname.includes('admin.hatexcard.com')) {
    if (!url.pathname.startsWith('/admin')) {
      url.pathname = `/admin${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (user && !url.pathname.startsWith('/api') && !url.pathname.startsWith('/login')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_session_token')
      .eq('id', user.id)
      .maybeSingle();

    const deviceTag = request.cookies.get(SESSION_TAG_COOKIE)?.value;
    if (profile?.current_session_token && profile.current_session_token !== deviceTag) {
      await supabase.auth.signOut();
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('reason', 'session_replaced');
      return NextResponse.redirect(loginUrl);
    }
  }

  if (url.pathname.startsWith('/admin')) {
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  const needsWalletAuth = PROTECTED_WALLET_PREFIXES.some((p) => url.pathname.startsWith(p));
  if (needsWalletAuth && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (
    user &&
    !url.pathname.startsWith('/login') &&
    !url.pathname.startsWith('/api') &&
    (url.pathname.startsWith('/admin') ||
      url.pathname.startsWith('/dashboard') ||
      url.pathname.startsWith('/setting') ||
      url.pathname.startsWith('/workspace') ||
      needsWalletAuth)
  ) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (url.pathname.startsWith('/workspace') && !url.pathname.startsWith('/workspace-login') && !url.pathname.startsWith('/workspace-setup')) {
    if (!user?.email) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const { data: staff } = await supabase
      .from('staff_users')
      .select('status, workspace_password_hash')
      .eq('email', user.email.trim().toLowerCase())
      .maybeSingle();

    if (!staff || staff.status === 'revoked') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (!staff.workspace_password_hash) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const gateToken = request.cookies.get(WORKSPACE_GATE_COOKIE)?.value;
    if (!verifyWorkspaceGateToken(gateToken, user.email)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  if (url.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
  runtime: 'nodejs',
};
