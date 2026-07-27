import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';
import type { User, SupabaseClient } from '@supabase/supabase-js';

export type MoneyAuthOk = {
  ok: true;
  user: User;
  supabase: SupabaseClient;
};

export type MoneyAuthFail = {
  ok: false;
  response: NextResponse;
};

/**
 * Verifye sesyon + MFA (aal2) pou API ki deplase lajan.
 * Si itilizatè a gen MFA enroll, li dwe deja verifye (aal2) — pa jis PIN.
 */
export async function requireMoneySession(): Promise<MoneyAuthOk | MoneyAuthFail> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 }),
    };
  }

  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            message: 'Verifye kòd MFA (2FA) ou anvan ou fè operasyon lajan.',
            code: 'mfa_required',
          },
          { status: 403 }
        ),
      };
    }
  } catch {
    // Si MFA API echwe, pa kite lajan pase san verifye
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: 'Pa t kapab verifye MFA. Rekonekte epi eseye ankò.' },
        { status: 503 }
      ),
    };
  }

  return { ok: true, user, supabase };
}
