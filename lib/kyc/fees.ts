/** Frè KYC konplè (verifikasyon ID + kat vityèl + terminal) — pa gen frè 520 HTG apa. */
export const KYC_FEE_HTG = 1150;

export function computeKycFeeAmount(discountAmount: number = 0): number {
  return Math.max(0, KYC_FEE_HTG - Math.max(0, Number(discountAmount) || 0));
}
