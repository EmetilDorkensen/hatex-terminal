import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { assertLoginAllowed } from '@/lib/auth/login-access';

/** Sèlman chemen relatif sou menm sit — pa open redirect. */
function safeNextPath(raw: string | null): string {
  if (!raw) return '/auth/complete';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/auth/complete';
  }
  if (raw.includes('://') || /^\/[a-z]+:/i.test(raw)) {
    return '/auth/complete';
  }
  return raw;
}

function displayNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const meta = user.user_metadata || {};
  for (const key of ['full_name', 'name', 'given_name']) {
    const v = meta[key];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 120);
  }
  const email = (user.email || '').trim().toLowerCase();
  return email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || 'Kliyan';
}

/** Echanj kòd (imèl / Google OAuth) → sesyon, profile, epi redireksyon. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=google_no_email`);
  }

  const email = user.email.trim().toLowerCase();
  const access = await assertLoginAllowed(email);
  if (!access.ok) {
    await supabase.auth.signOut();
    const q = new URLSearchParams({
      error: 'login_closed',
      message: access.message,
    });
    return NextResponse.redirect(`${origin}/login?${q.toString()}`);
  }

  // Asire profile egziste (Google pa pase /api/auth/signup)
  try {
    const db = createSupabaseAdminClient();
    const { data: existing } = await db
      .from('profiles')
      .select('id, full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!existing) {
      const fullName = displayNameFromUser(user);
      const { error: profileError } = await db.from('profiles').upsert(
        {
          id: user.id,
          email,
          full_name: fullName,
          kyc_status: 'not_submitted',
        },
        { onConflict: 'id' }
      );
      if (profileError) {
        console.error('auth/callback profile upsert:', profileError.message);
      }
    } else if (!existing.full_name) {
      await db
        .from('profiles')
        .update({ full_name: displayNameFromUser(user), email })
        .eq('id', user.id);
    }
  } catch (e) {
    console.error('auth/callback profile:', e instanceof Error ? e.message : e);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
