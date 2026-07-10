import type { SupabaseClient } from '@supabase/supabase-js';

export type MfaTotpVerifyResult = {
  ok: boolean;
  message?: string;
  challengeId?: string;
};

/** Asire sesyon an gen yon itilizatè valab (sub) anvan apèl MFA. */
export async function ensureAuthSessionForMfa(
  supabase: SupabaseClient
): Promise<{ ok: boolean; message?: string }> {
  const { error: refreshErr } = await supabase.auth.refreshSession();
  if (refreshErr) {
    return {
      ok: false,
      message: 'Sesyon ekspire. Dekonekte epi rekonekte ak modpas ou.',
    };
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user?.id) {
    return {
      ok: false,
      message:
        userErr?.message?.toLowerCase().includes('sub')
          ? 'Sesyon pa konplè. Fèmen paj la, rekonekte ak modpas ou, epi antre kòd MFA a ankò.'
          : 'Sesyon pa valab. Rekonekte ak modpas ou.',
    };
  }

  return { ok: true };
}

/** Kòmanse yon defi MFA (etap 1). */
export async function createMfaChallenge(
  supabase: SupabaseClient,
  factorId: string
): Promise<MfaTotpVerifyResult> {
  const session = await ensureAuthSessionForMfa(supabase);
  if (!session.ok) {
    return { ok: false, message: session.message };
  }

  const { data: challenge, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error || !challenge?.id) {
    return {
      ok: false,
      message: error?.message || 'Pa t kapab kòmanse verifikasyon MFA.',
    };
  }

  return { ok: true, challengeId: challenge.id };
}

/**
 * Verifye kòd TOTP — itilize challenge + verify (pi fyab pase challengeAndVerify).
 * Si challengeId bay la ekspire, nou kreye yon nouvo otomatikman.
 */
export async function verifyMfaTotpCode(
  supabase: SupabaseClient,
  factorId: string,
  code: string,
  challengeId?: string | null
): Promise<MfaTotpVerifyResult> {
  const session = await ensureAuthSessionForMfa(supabase);
  if (!session.ok) {
    return { ok: false, message: session.message };
  }

  const cleanCode = code.replace(/\D/g, '').trim();
  if (cleanCode.length !== 6) {
    return { ok: false, message: 'Kòd MFA a dwe gen 6 chif.' };
  }

  const runVerify = async (cid: string) => {
    return supabase.auth.mfa.verify({
      factorId,
      challengeId: cid,
      code: cleanCode,
    });
  };

  let activeChallengeId = challengeId || null;

  if (!activeChallengeId) {
    const created = await createMfaChallenge(supabase, factorId);
    if (!created.ok || !created.challengeId) {
      return { ok: false, message: created.message };
    }
    activeChallengeId = created.challengeId;
  }

  let { error: verifyErr } = await runVerify(activeChallengeId);

  if (verifyErr) {
    const msg = (verifyErr.message || '').toLowerCase();
    const retryable =
      msg.includes('challenge') || msg.includes('expired') || msg.includes('not found');

    if (retryable) {
      const created = await createMfaChallenge(supabase, factorId);
      if (created.ok && created.challengeId) {
        const retry = await runVerify(created.challengeId);
        verifyErr = retry.error;
        if (!verifyErr) {
          return { ok: true, challengeId: created.challengeId };
        }
      }
    }

    if (verifyErr?.message?.toLowerCase().includes('sub')) {
      return {
        ok: false,
        message:
          'Sesyon pa konplè pou MFA. Rekonekte ak modpas ou, epi antre kòd otantifikatè a imedyatman.',
      };
    }

    return { ok: false, message: verifyErr?.message || 'Kòd MFA a pa bon.' };
  }

  return { ok: true, challengeId: activeChallengeId };
}
