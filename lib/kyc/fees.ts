/** Premye pati: soumèt dokiman KYC → pwofi biznis. */
export const KYC_SUBMIT_FEE_HTG = 525;

/** Dezyèm pati: debloke kat + terminal + invoice apre apwobasyon. */
export const KYC_UNLOCK_FEE_HTG = 525;

/** @deprecated Itilize KYC_SUBMIT_FEE_HTG — total dezyèm pati apa. */
export const KYC_FEE_HTG = KYC_SUBMIT_FEE_HTG;

export function computeKycFeeAmount(discountAmount: number = 0): number {
  return Math.max(0, KYC_SUBMIT_FEE_HTG - Math.max(0, Number(discountAmount) || 0));
}

export function computeUnlockFeeAmount(): number {
  return KYC_UNLOCK_FEE_HTG;
}
