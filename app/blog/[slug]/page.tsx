"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { BLOG_POSTS } from "@/lib/blog/posts";

/**
 * Atik blog — kontni ki matche pwodwi aktyèl (pasèl MonCash, fakti, API, KYC).
 */

type BodyBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "callout"; text: string };

const ARTICLES: Record<
  string,
  { lead: string; body: BodyBlock[]; cta?: { href: string; label: string } }
> = {
  "woocommerce-moncash": {
    lead:
      "Si ou gen yon boutik WooCommerce, checkout MonCash an Goud ka fè kliyan ou fini acha a san yo pa kite sit ou pou voye lajan nan yon lòt app.",
    body: [
      {
        type: "h3",
        text: "Poukisa plugin la ede lavant yo",
      },
      {
        type: "p",
        text: "Anpil kliyan Ayiti deja gen MonCash. Lè yo ka peye dirèk nan checkout ou, yo pa bezwen kite panyen an pou « voye m lajan » sou WhatsApp. Sa diminye abandònman panyen epi fè ou resevwa otomatikman sou nimewo MonCash biznis ou.",
      },
      {
        type: "h3",
        text: "Kijan pou enstale l",
      },
      {
        type: "ul",
        items: [
          "Pase KYC epi konekte nimewo MonCash ou sou dashboard HatexCard.",
          "Ale nan /plugin, telechaje ZIP la (kle API a gentan dedans).",
          "Nan WordPress: Plugins → Add New → Upload → aktive HatexCard MonCash.",
          "Nan WooCommerce → Peman, aktive metòd la epi chwazi HTG (oswa USD ak to konvèsyon).",
        ],
      },
      {
        type: "callout",
        text: "Pa janm pataje ZIP ki gen kle live nan chat piblik. Si ZIP la tonbe nan men move moun, rotate kle live a imedyatman ak kòd MFA.",
      },
      {
        type: "h3",
        text: "Apre yon peman",
      },
      {
        type: "p",
        text: "Kliyan an konfime sou telefòn li. HatexCard verifye ak MonCash, make kòmand lan peye, epi voye rès la sou MonCash ou. Ou ka swiv tout bagay nan dashboard ak notifikasyon imèl / webhook.",
      },
    ],
    cta: { href: "/plugin", label: "Telechaje plugin WooCommerce" },
  },
  "fakti-ak-lyen-pwodwi": {
    lead:
      "Ou vann sou WhatsApp oswa Instagram? Ou pa bezwen yon sit konplè pou resevwa lajan an Goud — fakti ak lyen pwodwi fèt pou sa.",
    body: [
      {
        type: "h3",
        text: "Smart Invoice",
      },
      {
        type: "p",
        text: "Kreye yon fakti ak montan ak deskripsyon, jenere yon lyen sekirize, epi voye l bay kliyan pa imèl oswa mesaj. Kliyan an louvri lyen an, antre nimewo MonCash li, konfime ak PIN li — ou resevwa otomatikman.",
      },
      {
        type: "h3",
        text: "Lyèn pwodwi /p/...",
      },
      {
        type: "p",
        text: "Mete yon pwodwi ak pri yon fwa. Pataje lyen piblik la nan status WhatsApp, bio Instagram, oswa katalòg ou. Chak kliyan ki klike kapab peye san kont HatexCard — yo peye tankou sou yon fakti.",
      },
      {
        type: "ul",
        items: [
          "Pa gen redireksyon konplike: paj HatexCard la rete ak kliyan an pandan li konfime sou telefòn li.",
          "Ou resevwa notifikasyon lè peman an konfime.",
          "Frè pasèl la klè — ou mande yon pri, ou resevwa sa ou te mande a (frè yo sou bò kliyan an selon plan ou).",
        ],
      },
      {
        type: "callout",
        text: "Toujou verifye non biznis ou parèt byen sou paj checkout la — sa ba kliyan ou konfyans.",
      },
    ],
    cta: { href: "/signup", label: "Ouvri kont gratis" },
  },
  "api-webhooks-sekirite": {
    lead:
      "API HatexCard fèt pou sit ak app ou. Men 5 pratik ki pwoteje lajan ou ak kle ou — tankou sa Authorize.net ak Stripe mande.",
    body: [
      {
        type: "h3",
        text: "1. Separe test ak live",
      },
      {
        type: "p",
        text: "hx_sk_test_... pa janm fè peman reyèl. hx_sk_live_... pa janm nan navigatè kliyan an. Sere yo nan varyab anviwònman sou sèvè ou sèlman.",
      },
      {
        type: "h3",
        text: "2. Idempotency-Key",
      },
      {
        type: "p",
        text: "Chak fwa ou kreye yon peman, voye yon kle inik (egzanp order-123-v1). Si rezo a double demann lan, ou pa kreye de peman.",
      },
      {
        type: "h3",
        text: "3. Verifye siyati webhook",
      },
      {
        type: "p",
        text: "Lè HatexCard voye payment.success, verifye HMAC ak secret whsec_... ou anvan ou make kòmand lan peye. Pa fè konfyans yon POST san siyati.",
      },
      {
        type: "h3",
        text: "4. Rotate ak MFA",
      },
      {
        type: "p",
        text: "Si yon kle ekspoze, rotate mòd sa a sou /developer — ou dwe antre kòd MFA 6 chif. Ansyen kle a sispann mache imedyatman.",
      },
      {
        type: "h3",
        text: "5. Pa mete sekrè nan frontend",
      },
      {
        type: "ul",
        items: [
          "Pa nan HTML, JS navigatè, ni app mobil kliyan.",
          "Pa nan screenshot, ni nan chat Discord/WhatsApp piblik.",
          "Pa nan repo GitHub piblik — itilize .env sou sèvè a.",
        ],
      },
      {
        type: "callout",
        text: "checkout_url API a se yon paj HatexCard (telefòn-premye). Voye kliyan an la — li peye menm jan ak fakti/pwodwi, san redireksyon sou paj Digicel nan menm onglet la.",
      },
    ],
    cta: { href: "/developer/docs", label: "Li dokiman API" },
  },
  "kyc-mfa-sekirite-kont": {
    lead:
      "KYC ak MFA pa se « papye pou papye ». Yo pwoteje kont ou, payout ou, ak kle API ou kont fwod.",
    body: [
      {
        type: "h3",
        text: "KYC (Know Your Customer)",
      },
      {
        type: "p",
        text: "Anvan ou resevwa lajan live, ou verifye idantite ou (pyès ID + selfie). Sa pèmèt nou konfòme ak règleman anti-blanchiman epi anpeche moun louvri kont ak fo non pou fwod.",
      },
      {
        type: "h3",
        text: "MFA (2FA)",
      },
      {
        type: "p",
        text: "Otantifikasyon de faktè (aplikasyon otantifikatè) obligatwa pou koneksyon ak pou aksyon sansib tankou rotate kle API. Menm si yon moun jwenn modpas ou, yo pa ka woule kle ou san telefòn ou.",
      },
      {
        type: "h3",
        text: "Bon abitid",
      },
      {
        type: "ul",
        items: [
          "Pa pataje modpas, kòd MFA, ni PIN MonCash — HatexCard p ap janm mande yo pa imèl oswa WhatsApp.",
          "Si ou wè yon tranzaksyon ou pa rekonèt, kontakte sipò imedyatman.",
          "Rotate kle live a si ou panse li te ekspoze.",
        ],
      },
      {
        type: "callout",
        text: "Li Politik Konfidansyalite a pou konnen kijan nou trete done KYC ou — nou pa vann yo, epi nou kenbe yo pou obligasyon legal/AML.",
      },
    ],
    cta: { href: "/politik", label: "Li politik konfidansyalite" },
  },
};

export default function BlogArticlePage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const meta = BLOG_POSTS.find((p) => p.slug === slug);
  const article = slug ? ARTICLES[slug] : undefined;

  if (!meta || !article) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center justify-center p-6 text-center">
        <BookOpen className="text-slate-300 mb-4" size={40} />
        <h1 className="text-xl font-extrabold text-slate-900 mb-2">Atik pa jwenn</h1>
        <p className="text-sm text-slate-500 mb-6">Atik sa a pa egziste oswa li te retire.</p>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 bg-[#1d4ed8] text-white text-sm font-bold px-5 py-3 rounded-xl"
        >
          Retounen nan blog
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900 font-sans selection:bg-blue-100 pb-24">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-3xl mx-auto p-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/blog")}
            className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:text-[#1d4ed8] hover:bg-slate-50 transition-colors shadow-sm"
            aria-label="Retounen nan blog"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Blog · {meta.category}
          </span>
        </div>
      </div>

      <article className="max-w-3xl mx-auto p-5 md:p-8 mt-6">
        <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-[#1d4ed8] bg-blue-50 border border-blue-100 px-3 py-1 rounded-md mb-4">
          {meta.category}
        </span>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight mb-3">
          {meta.title}
        </h1>
        <p className="text-[13px] font-semibold text-slate-400 mb-8">
          {meta.date} · {meta.readMin} min li
        </p>
        <p className="text-lg text-slate-600 font-medium leading-relaxed border-l-4 border-[#1d4ed8] pl-4 mb-10">
          {article.lead}
        </p>

        <div className="space-y-5 text-[15px] text-slate-600 leading-relaxed font-medium">
          {article.body.map((block, i) => {
            if (block.type === "h3") {
              return (
                <h2
                  key={`${block.type}-${i}`}
                  className="text-xl font-extrabold text-slate-900 pt-4"
                >
                  {block.text}
                </h2>
              );
            }
            if (block.type === "ul") {
              return (
                <ul
                  key={`${block.type}-${i}`}
                  className="list-disc list-inside space-y-2 ml-1"
                >
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              );
            }
            if (block.type === "callout") {
              return (
                <div
                  key={`${block.type}-${i}`}
                  className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-slate-700"
                >
                  {block.text}
                </div>
              );
            }
            return <p key={`${block.type}-${i}`}>{block.text}</p>;
          })}
        </div>

        {article.cta && (
          <div className="mt-12 pt-8 border-t border-slate-200">
            <Link
              href={article.cta.href}
              className="inline-flex items-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-bold px-6 py-3.5 rounded-xl transition-colors"
            >
              {article.cta.label}
              <ArrowRight size={16} />
            </Link>
          </div>
        )}

        <div className="mt-10">
          <Link
            href="/blog"
            className="text-sm font-bold text-[#1d4ed8] hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft size={14} /> Tout atik yo
          </Link>
        </div>
      </article>
    </div>
  );
}
