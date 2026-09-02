/**
 * Kalkil frè HatexCard v2.
 *
 * Prensip: KLIYAN an peye frè yo anplis — machann nan resevwa montan konplè li mande a.
 *
 *   kliyan_peye = montan_machann + frè_hatexcard + frè_transfè_moncash
 */

export type FeeConfig = {
  /** Pousantaj HatexCard sou montan machann nan. */
  platform_fee_percent: number;
  /** Frè minimòm HatexCard an HTG (0 = pa gen minimòm). */
  platform_fee_min_htg: number;
  /** Pousantaj estimasyon frè transfè MonCash pou payout la. */
  payout_fee_percent: number;
  /** Frè transfè minimòm an HTG. */
  payout_fee_min_htg: number;
};

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  platform_fee_percent: 2,
  platform_fee_min_htg: 0,
  payout_fee_percent: 1,
  payout_fee_min_htg: 5,
};

export type FeeBreakdown = {
  /** Sa machann nan mande / ap resevwa. */
  merchantAmount: number;
  /** Frè HatexCard (revni nou). */
  platformFee: number;
  /** Frè nou estime MonCash ap pran sou payout la. */
  payoutFee: number;
  /** Total kliyan an ap peye sou MonCash. */
  clientTotal: number;
};

function normalizeConfig(config?: Partial<FeeConfig>): FeeConfig {
  const merged = { ...DEFAULT_FEE_CONFIG, ...config };
  return {
    platform_fee_percent: Math.max(Number(merged.platform_fee_percent) || 0, 0),
    platform_fee_min_htg: Math.max(Number(merged.platform_fee_min_htg) || 0, 0),
    payout_fee_percent: Math.max(Number(merged.payout_fee_percent) || 0, 0),
    payout_fee_min_htg: Math.max(Number(merged.payout_fee_min_htg) || 0, 0),
  };
}

/**
 * Kalkile frè yo depi montan machann nan mande.
 * Tout montan yo won an antye paske MonCash aksepte montan antye an HTG.
 */
export function computeFees(
  merchantAmountRaw: number,
  config?: Partial<FeeConfig>
): FeeBreakdown | null {
  const cfg = normalizeConfig(config);
  const merchantAmount = Math.round(Number(merchantAmountRaw));

  if (!Number.isFinite(merchantAmount) || merchantAmount <= 0) return null;

  const platformFee = Math.max(
    Math.round((merchantAmount * cfg.platform_fee_percent) / 100),
    cfg.platform_fee_min_htg
  );

  const payoutFee = Math.max(
    Math.round((merchantAmount * cfg.payout_fee_percent) / 100),
    cfg.payout_fee_min_htg
  );

  return {
    merchantAmount,
    platformFee,
    payoutFee,
    clientTotal: merchantAmount + platformFee + payoutFee,
  };
}

/**
 * Chemen envès: depi total kliyan an peye, konbyen machann nan dwe resevwa.
 * Itil lè yon peman rive ak yon montan nou pa t kalkile (rekonsilyasyon).
 */
export function merchantAmountFromClientTotal(
  clientTotal: number,
  config?: Partial<FeeConfig>
): FeeBreakdown | null {
  const total = Math.round(Number(clientTotal));
  if (!Number.isFinite(total) || total <= 0) return null;

  // Chèche montan machann ki bay total sa a (frè yo gen minimòm, donk pa lineyè)
  let low = 1;
  let high = total;
  let best: FeeBreakdown | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = computeFees(mid, config);
    if (!candidate) break;

    if (candidate.clientTotal === total) return candidate;
    if (candidate.clientTotal < total) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}
