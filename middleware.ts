import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { WORKSPACE_GATE_COOKIE, verifyWorkspaceGateToken } from '@/lib/security/workspace-gate';
import { SESSION_TAG_COOKIE } from '@/lib/security/session-tag';

const ADMIN_EMAIL = 'adminhatexcard@gmail.com';

const PROTECTED_APP_PREFIXES = [
  '/kyc',
  '/plugin',
  '/invoice',
  '/enterprise',
  '/setting',
  '/developer',
  '/notifikasyon',
  '/agent',
  '/kat',
  '/support',
  '/update-pin',
];

/** API ki pa bezwen sesyon cookie (kle API / webhook / cron / checkout piblik). */
const PUBLIC_API_PREFIXES = [
  '/api/moncash',
  '/api/create-payment',
  '/api/public',
  '/api/cron',
  '/api/checkout',
  '/api/checkout-invoice',
  '/api/v2/payments',
];

function isAdminEmail(email: string | undefined | null): boolean {
  return !!email && email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  if (hostname.includes('admin.hatexcard.com')) {
    if (!url.pathname.startsWith('/admin')) {
      url.pathname = `/admin${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  let profile: { current_session_token?: string | null; plan?: string | null } | null = null;

  const shouldCheckSessionTag =
    !!user &&
    !url.pathname.startsWith('/login') &&
    (!url.pathname.startsWith('/api') ||
      (url.pathname.startsWith('/api') && !isPublicApi(url.pathname)));

  if (shouldCheckSessionTag) {
    const { data } = await supabase
      .from('profiles')
      .select('current_session_token, plan')
      .eq('id', user!.id)
      .maybeSingle();
    profile = data;

    const deviceTag = request.cookies.get(SESSION_TAG_COOKIE)?.value;
    if (profile?.current_session_token && profile.current_session_token !== deviceTag) {
      await supabase.auth.signOut();
      if (url.pathname.startsWith('/api')) {
        return NextResponse.json(
          { error: 'Sesyon ranplase sou yon lòt aparèy. Konekte ankò.' },
          { status: 401 }
        );
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('reason', 'session_replaced');
      return NextResponse.redirect(loginUrl);
    }
  }

  if (url.pathname.startsWith('/admin')) {
    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  const needsAppAuth = PROTECTED_APP_PREFIXES.some((p) => url.pathname.startsWith(p));
  if (needsAppAuth && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (
    user &&
    !url.pathname.startsWith('/login') &&
    !url.pathname.startsWith('/api') &&
    !url.pathname.startsWith('/mfa-setup') &&
    (url.pathname.startsWith('/admin') ||
      url.pathname.startsWith('/dashboard') ||
      url.pathname.startsWith('/notifikasyon') ||
      url.pathname.startsWith('/setting') ||
      url.pathname.startsWith('/workspace') ||
      url.pathname.startsWith('/plan') ||
      url.pathname.startsWith('/agent') ||
      url.pathname.startsWith('/kat') ||
      url.pathname.startsWith('/support') ||
      url.pathname.startsWith('/update-pin') ||
      needsAppAuth)
  ) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // MFA OBLIGATWA pou tout kont — admin enkli.
    const { data: factorList } = await supabase.auth.mfa.listFactors();
    const hasVerifiedTotp = (factorList?.totp || []).some((f) => f.status === 'verified');
    if (!hasVerifiedTotp) {
      return NextResponse.redirect(new URL('/mfa-setup', request.url));
    }

    // Premye koneksyon: chwazi plan anvan dashboard
    if (
      !isAdminEmail(user.email) &&
      !profile?.plan &&
      !url.pathname.startsWith('/plan') &&
      !url.pathname.startsWith('/mfa-setup')
    ) {
      return NextResponse.redirect(new URL('/plan', request.url));
    }
  }

  if (
    url.pathname.startsWith('/workspace') &&
    !url.pathname.startsWith('/workspace-login') &&
    !url.pathname.startsWith('/workspace-setup')
  ) {
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

  if (url.pathname.startsWith('/plan') && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (url.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: [String.raw`/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)`],
  runtime: 'nodejs',
};
