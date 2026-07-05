import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// ELIJIBILITE & PWOVIZYON KREDANSYÈL API MACHANN
// ============================================================================
// Yon kont ka jwenn aksè API otomatikman SÈLMAN si TOUDE kondisyon sa yo vre:
//   1. KYC kont kliyan an APWOUVE nan tab profiles (kyc_status === 'approved')
//   2. Li peye frè aktivasyon kat la (is_card_activated === true)
//
// Lè yon kont elijib men l poko gen kredansyèl (api_key / is_merchant /
// webhook_secret), `ensureMerchantApiCredentials` jenere yo otomatikman epi
// mete yo ajou nan baz done a. Sa a fèmen twou pwovizyone a nèt: pa gen okenn
// entèvansyon manyèl nesesè.
// ============================================================================

export type MerchantEligibility = {
  eligible: boolean;
  missingKyc: boolean;
  missingCardActivation: boolean;
};

export type ProvisionResult = {
  api_key: string | null;
  is_merchant: boolean;
  webhook_secret: string | null;
  provisioned: boolean;
  eligibility: MerchantEligibility;
};

type MerchantProfileLike = {
  id: string;
  kyc_status?: string | null;
  is_card_activated?: boolean | null;
  api_key?: string | null;
  is_merchant?: boolean | null;
  webhook_secret?: string | null;
};

export function checkMerchantEligibility(profile: MerchantProfileLike | null | undefined): MerchantEligibility {
  const kycOk = profile?.kyc_status === 'approved';
  const cardOk = profile?.is_card_activated === true;
  const result = {
    eligible: kycOk && cardOk,
    missingKyc: !kycOk,
    missingCardActivation: !cardOk,
  };
  // #region agent log
  fetch('http://127.0.0.1:7300/ingest/e9f1fe4c-b3fd-4eaf-84be-ae95b4331381',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'138d33'},body:JSON.stringify({sessionId:'138d33',runId:'pre-fix',hypothesisId:'A-C',location:'merchant-provisioning.ts:checkMerchantEligibility',message:'eligibility computed',data:{profileId:profile?.id??null,kyc_status:profile?.kyc_status??null,kycOk,is_card_activated:profile?.is_card_activated??null,cardOk,result},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return result;
}

// Jenerasyon token izomòfik (mache ni nan navigatè ni sou sèvè Node 19+).
function randomToken(prefix: string): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Asire yon kont elijib gen tout kredansyèl API li yo. Si kont lan poko elijib,
 * pa jenere anyen. Si l elijib men manke youn nan kredansyèl yo, konplete sa ki
 * manke SÈLMAN (pa regenere yon api_key ki egziste deja pou pa kraze
 * entegrasyon k ap mache deja).
 */
export async function ensureMerchantApiCredentials(
  supabase: SupabaseClient,
  profile: MerchantProfileLike
): Promise<ProvisionResult> {
  const eligibility = checkMerchantEligibility(profile);

  if (!eligibility.eligible) {
    return {
      api_key: profile.api_key || null,
      is_merchant: profile.is_merchant === true,
      webhook_secret: profile.webhook_secret || null,
      provisioned: false,
      eligibility,
    };
  }

  const needsProvision = !profile.api_key || !profile.is_merchant || !profile.webhook_secret;

  const apiKey = profile.api_key || randomToken('hx_live_');
  const webhookSecret = profile.webhook_secret || randomToken('whsec_');

  if (needsProvision) {
    const { error } = await supabase
      .from('profiles')
      .update({ api_key: apiKey, is_merchant: true, webhook_secret: webhookSecret })
      .eq('id', profile.id);

    if (error) {
      return {
        api_key: profile.api_key || null,
        is_merchant: profile.is_merchant === true,
        webhook_secret: profile.webhook_secret || null,
        provisioned: false,
        eligibility,
      };
    }
  }

  return {
    api_key: apiKey,
    is_merchant: true,
    webhook_secret: webhookSecret,
    provisioned: needsProvision,
    eligibility,
  };
}
