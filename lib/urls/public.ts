/**
 * URL piblik ofisyèl — pa janm vercel.app preview ni localhost pou MonCash.
 * Alert/Return nan pòtay Digicel dwe: https://hatexcard.com/api/moncash/alert
 * ak https://hatexcard.com/api/moncash/return
 */
export const CANONICAL_SITE_URL = 'https://hatexcard.com';

function isUnusableHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.endsWith('.vercel.app') ||
    h.endsWith('.vercel.sh')
  );
}

export function publicSiteUrl(): string {
  const raw = (
    process.env.MONCASH_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    CANONICAL_SITE_URL
  ).replace(/\/$/, '');

  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return CANONICAL_SITE_URL;
    if (isUnusableHost(url.hostname)) return CANONICAL_SITE_URL;
    return `${url.protocol}//${url.host}`;
  } catch {
    return CANONICAL_SITE_URL;
  }
}

export function isPreviewOrLocalUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    return isUnusableHost(new URL(raw).hostname);
  } catch {
    return true;
  }
}

/**
 * Rezònman "URL opak": lyen piblik yo dwe itilize yon share_token (32 hex)
 * olye id entèn DB (uuid) — konsa nou pa ekspoze id machann/fakti nan URL,
 * e-mail, order refs ni nan query params apre redireksyon MonCash.
 */

export type PublicLinkRow = {
  id: string;
  slug?: string | null;
  share_token?: string | null;
};

/** Token opak si disponib; sinon slug (pwodwi) osinon id (fakti / legacy). */
export function publicRef(row: PublicLinkRow, fallbackToSlug = false): string {
  if (row.share_token && /^[0-9a-f]{32}$/i.test(row.share_token)) return row.share_token;
  if (fallbackToSlug && row.slug) return row.slug;
  return row.id;
}

/** Chemin paj peman piblik yon pwodwi (/p/[ref]). */
export function productPayPath(product: PublicLinkRow): string {
  return `/p/${encodeURIComponent(publicRef(product, true))}`;
}

/** Chemin paj fakti piblik (/checkout-invoice/[ref]). */
export function invoicePayPath(invoice: PublicLinkRow): string {
  return `/checkout-invoice/${encodeURIComponent(publicRef(invoice, false))}`;
}

/** URL konplè paj peman pwodwi (dashboard / kopi lyen). */
export function productPublicUrl(origin: string, product: PublicLinkRow): string {
  return `${origin.replace(/\/$/, '')}${productPayPath(product)}`;
}

/** URL konplè paj fakti (kopi lyen / e-mail / WhatsApp). */
export function invoicePublicUrl(origin: string, invoice: PublicLinkRow): string {
  return `${origin.replace(/\/$/, '')}${invoicePayPath(invoice)}`;
}
