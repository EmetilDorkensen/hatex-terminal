/**
 * Elijibilite machann — lojik pi — san baz done / sekrè.
 * Ka enpòte nan "use client".
 */

export type MerchantEligibility = {
  eligible: boolean;
  missingKyc: boolean;
  /** @deprecated Toujou false — frè 525 retire */
  missingCardActivation: boolean;
};

type MerchantProfileLike = {
  kyc_status?: string | null;
  plan?: string | null;
};

/** Menm kondisyon ak Dashboard: KYC apwouve oswa plan = debloke. */
export function checkMerchantEligibility(
  profile: MerchantProfileLike | null | undefined
): MerchantEligibility {
  const kycOk = profile?.kyc_status === 'approved';
  const hasPlan =
    profile?.plan === 'free' || profile?.plan === 'capacity' || profile?.plan === 'premium';
  return {
    eligible: hasPlan || kycOk,
    missingKyc: !kycOk,
    missingCardActivation: false,
  };
}

export function canAccessTerminal(profile: MerchantProfileLike | null | undefined): boolean {
  return checkMerchantEligibility(profile).eligible;
}
