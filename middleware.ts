import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { WORKSPACE_GATE_COOKIE, verifyWorkspaceGateToken } from '@/lib/security/workspace-gate';
import { SESSION_TAG_COOKIE } from '@/lib/security/session-tag';

const ADMIN_EMAIL = 'adminhatexcard@gmail.com';

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

  // 🔒 YON SÈL APARÈY KONEKTE ALAFWA: chak koneksyon jenere yon nouvo "tag"
  // (gade app/api/auth/track-login/route.ts). Si tag aparèy sa a pa matche
  // dènye tag ki anrejistre sou pwofil la, se paske yon LÒT aparèy konekte
  // sou menm kont lan depi lè sa a — nou dekonekte aparèy sa a otomatikman.
  if (session && !url.pathname.startsWith('/api') && !url.pathname.startsWith('/login')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_session_token')
      .eq('id', session.user.id)
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
    if (!session || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Si kont admin la anrejistre yon aparèy MFA (TOTP), sesyon an DWE fin
    // pase pa etap MFA (aal2) — yon cookie sesyon aal1 vòlè pa ka sifi.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // /workspace-login ak /workspace-setup se ansyen paj ki depreke — yo
  // rekondwi tèt yo, kidonk yo pa bezwen pwoteksyon isit la.
  if (url.pathname.startsWith('/workspace') && !url.pathname.startsWith('/workspace-login') && !url.pathname.startsWith('/workspace-setup')) {
    if (!session || !session.user.email) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Sekirite Kouch 1: imel la dwe nan lis anplwaye aktif (staff_users).
    // RLS pèmèt yon itilizatè li SÈLMAN pwòp liy pa li (gade migrasyon
    // 20260709_workspace_staff_security.sql).
    const { data: staff } = await supabase
      .from('staff_users')
      .select('status, workspace_password_hash')
      .eq('email', session.user.email.trim().toLowerCase())
      .maybeSingle();

    if (!staff || staff.status === 'revoked') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Sekirite Kouch 2: menm si l se yon anplwaye, li dwe fin kreye epi
    // konfime modpas fò espas travay li a (cookie gate siyen ak HMAC,
    // mare ak menm imel la, valab 8 èdtan). Sa anpeche moun ki jis
    // konekte sou kont kliyan yo antre nan /workspace san yo pa pase
    // pa bouton "Aksè Espas Travay" la sou dashboard.
    if (!staff.workspace_password_hash) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const gateToken = request.cookies.get(WORKSPACE_GATE_COOKIE)?.value;
    if (!verifyWorkspaceGateToken(gateToken, session.user.email)) {
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
  // Bezwen runtime Node.js paske workspace-gate.ts itilize modil 'crypto'
  // Node (createHmac) pou verifye cookie gate espas travay la ak HMAC.
  runtime: 'nodejs',
};
