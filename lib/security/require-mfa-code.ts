import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyMfaTotpCode } from '@/lib/auth/mfa-totp';

/**
 * Step-up MFA: mande yon nouvo kòd TOTP menm si sesyon an deja aal2.
 * Pou aksyon sansib (rotate kle API, elatriye).
 */
export async function requireMfaTotpCode(
  supabase: SupabaseClient,
  rawCode: unknown
): Promise<{ ok: true } | { ok: false; status: number; error: string; code: string }> {
  const code = typeof rawCode === 'string' ? rawCode.replace(/\D/g, '').trim() : '';
  if (code.length !== 6) {
    return {
      ok: false,
      status: 400,
      code: 'mfa_code_required',
      error: 'Antre kòd MFA (6 chif) nan aplikasyon otantifikatè a pou woule kle a.',
    };
  }

  let factors: Awaited<ReturnType<typeof supabase.auth.mfa.listFactors>>['data'];
  try {
    const listed = await supabase.auth.mfa.listFactors();
    if (listed.error) {
      return {
        ok: false,
        status: 503,
        code: 'mfa_unavailable',
        error: 'Pa t kapab verifye MFA. Rekonekte epi eseye ankò.',
      };
    }
    factors = listed.data;
  } catch {
    return {
      ok: false,
      status: 503,
      code: 'mfa_unavailable',
      error: 'Pa t kapab verifye MFA. Rekonekte epi eseye ankò.',
    };
  }

  const totp = (factors?.totp || [])
    .filter((f) => f.status === 'verified')
    .sort((a, b) => Date.parse(b.created_at || '0') - Date.parse(a.created_at || '0'))[0];

  if (!totp) {
    return {
      ok: false,
      status: 403,
      code: 'mfa_not_enrolled',
      error: 'MFA (2FA) obligatwa pou woule kle API. Ale nan /mfa-setup pou aktive l.',
    };
  }

  const verified = await verifyMfaTotpCode(supabase, totp.id, code);
  if (!verified.ok) {
    return {
      ok: false,
      status: 403,
      code: 'mfa_invalid',
      error: verified.message || 'Kòd MFA a pa bon.',
    };
  }

  return { ok: true };
}
