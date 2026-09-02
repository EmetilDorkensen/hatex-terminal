import { publicSiteUrl } from '@/lib/urls/public';

/**
 * URL Alert / Return MonCash.
 *
 * API CreatePayment pa pran webhook nan kò a — Digicel Business Portal la
 * dwe gen de adrès sa yo (toujou hatexcard.com, pa vercel.app):
 *   Alert URL  → https://hatexcard.com/api/moncash/alert
 *   Return URL → https://hatexcard.com/api/moncash/return
 */

export function monCashPublicBaseUrl(): string {
  return publicSiteUrl();
}

export function monCashAlertUrl(): string {
  return `${monCashPublicBaseUrl()}/api/moncash/alert`;
}

export function monCashReturnUrl(): string {
  return `${monCashPublicBaseUrl()}/api/moncash/return`;
}
