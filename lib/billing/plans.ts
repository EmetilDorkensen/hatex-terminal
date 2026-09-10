/**
 * Plan abonnman HatexCard.
 *
 *  - free:      25 000 HTG / jou, KYC obligatwa
 *  - capacity: 150 000 HTG / jou, 599 HTG / mwa, KYC obligatwa
 *  - premium:  san limit jou, 999 HTG / mwa, KYC + plizyè nimewo MonCash
 */

export const PLAN_IDS = ['free', 'capacity', 'premium'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type PlanStatus =
  | 'none'
  | 'active'
  | 'pending_kyc'
  | 'pending_payment'
  | 'past_due'
  | 'expired';

export type PlanDefinition = {
  id: PlanId;
  name: string;
  tagline: string;
  dailyLimitHtg: number | null;
  monthlyPriceHtg: number;
  kycRequired: boolean;
  multiMoncash: boolean;
  bullets: string[];
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Gratis',
    tagline: 'Kòmanse vann jodi a',
    dailyLimitHtg: 25_000,
    monthlyPriceHtg: 0,
    kycRequired: true,
    multiMoncash: false,
    bullets: [
      'Aksè ak API, fakti, lyen piblik, vann sèvis',
      '25 000 HTG / jou sou TOUT kòb ou resevwa',
      'KYC obligatwa',
    ],
  },
  capacity: {
    id: 'capacity',
    name: 'Kapasite',
    tagline: 'Pou biznis k ap grandi',
    dailyLimitHtg: 150_000,
    monthlyPriceHtg: 599,
    kycRequired: true,
    multiMoncash: false,
    bullets: [
      '150 000 HTG / jou sou tout chanèl',
      '599 HTG / mwa',
      'KYC obligatwa',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premyòm',
    tagline: 'Pou gwo biznis',
    dailyLimitHtg: null,
    monthlyPriceHtg: 999,
    kycRequired: true,
    multiMoncash: true,
    bullets: [
      'San limit jou (si kont MonCash ou ka sipòte)',
      '999 HTG / mwa',
      'Plizyè nimewo MonCash — sistèm nan eseye youn apre lòt',
    ],
  },
};

export const PAYER_LIMIT_MESSAGE =
  'Kont machann nan pa elaji pou l resevwa lajan an.';

export const MERCHANT_EXPAND_MESSAGE =
  'Elaji kont ou (plan Kapasite 150 000 HTG oswa Premyòm) pou ou ka resevwa plis lajan chak jou.';

export type ProfilePlanRow = {
  plan?: string | null;
  plan_status?: string | null;
  plan_period_end?: string | null;
  intended_plan?: string | null;
  kyc_status?: string | null;
};

/** Plan ki vrèman aplike pou limit jou a (peman poko peye = 25k). */
export function effectivePlan(profile: ProfilePlanRow | null | undefined): PlanId {
  const plan = profile?.plan;
  const status = profile?.plan_status;
  const periodEnd = profile?.plan_period_end
    ? new Date(profile.plan_period_end).getTime()
    : 0;
  const paidActive =
    (plan === 'capacity' || plan === 'premium') &&
    status === 'active' &&
    periodEnd > Date.now();

  if (paidActive) return plan as PlanId;
  return 'free';
}

export function dailyLimitFor(
  profile: ProfilePlanRow | null | undefined,
  limits?: { free?: number; capacity?: number }
): number | null {
  const plan = effectivePlan(profile);
  if (plan === 'premium') return null;
  if (plan === 'capacity') return limits?.capacity ?? PLANS.capacity.dailyLimitHtg;
  return limits?.free ?? PLANS.free.dailyLimitHtg;
}

export function isPaidPlanId(id: string): id is 'capacity' | 'premium' {
  return id === 'capacity' || id === 'premium';
}
