/**
 * Meta atik blog HatexCard (lis + paj atik).
 */

export type BlogPostMeta = {
  slug: string;
  title: string;
  date: string;
  category: string;
  desc: string;
  readMin: number;
};

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "woocommerce-moncash",
    title: "Kòman ogmante lavant ou ak plugin WooCommerce MonCash",
    date: "12 Septanm 2026",
    category: "E-Commerce",
    desc: "Enstale ZIP HatexCard la, aktive checkout MonCash an Goud, epi diminye moun ki abandone panyen an — kliyan peye sou telefòn yo, ou resevwa sou MonCash ou.",
    readMin: 5,
  },
  {
    slug: "fakti-ak-lyen-pwodwi",
    title: "Fakti ak lyen pwodwi: vann sou WhatsApp san sit entènèt",
    date: "5 Septanm 2026",
    category: "Machann",
    desc: "Ou pa bezwen yon boutik konplè. Kreye yon fakti oswa yon lyen /p/..., pataje l sou WhatsApp oswa Instagram, epi resevwa peman MonCash otomatikman.",
    readMin: 4,
  },
  {
    slug: "api-webhooks-sekirite",
    title: "API ak webhooks: 5 pratik pou pwoteje kle ou yo",
    date: "28 Out 2026",
    category: "Devlopè",
    desc: "Kle test vs live, Idempotency-Key, verifye siyati webhook, MFA pou rotate kle, epi pa janm mete sekrè nan frontend.",
    readMin: 6,
  },
  {
    slug: "kyc-mfa-sekirite-kont",
    title: "KYC ak MFA: poukisa yo pwoteje kont machann ou",
    date: "18 Out 2026",
    category: "Sekirite",
    desc: "Verifikasyon ID, 2FA, ak alèt sekirite — sa HatexCard mande pou anpeche fwod epi kenbe payout ou an sekirite.",
    readMin: 4,
  },
];
