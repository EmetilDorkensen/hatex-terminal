export const KYC_STATUS = {
  NOT_SUBMITTED: 'not_submitted',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type KycStatus = (typeof KYC_STATUS)[keyof typeof KYC_STATUS];

export function isKycApproved(status: string | null | undefined): boolean {
  return status === KYC_STATUS.APPROVED;
}

export function isKycPendingReview(status: string | null | undefined): boolean {
  return status === KYC_STATUS.PENDING;
}

export function requiresKycForMoneyOut(status: string | null | undefined): boolean {
  return !isKycApproved(status);
}

export function kycStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case KYC_STATUS.APPROVED:
      return 'Apwouve';
    case KYC_STATUS.PENDING:
      return 'Nan revizyon';
    case KYC_STATUS.REJECTED:
      return 'Rejte';
    case KYC_STATUS.NOT_SUBMITTED:
    default:
      return 'Pa soumèt';
  }
}
