"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Code2,
  FileText,
  Globe2,
  Lock,
  Package,
  Plug,
  ShieldCheck,
  Smartphone,
  Zap,
} from "lucide-react";

/**
 * Landing page piblik Hatexcard — stil maketing (Authorize.net homepage),
 * PA dashboard machann. Kontni a baze sou pwodwi aktyèl: pasèl MonCash/NatCash,
 * fakti, pwodwi, plugin WooCommerce, API, plan, KYC.
 */

const NAV = [
  {
    label: "Pwodwi",
    href: "#pwodwi",
    sub: [
      { label: "Pasèl MonCash / NatCash", desc: "Kliyan peye, ou resevwa", href: "#kijan" },
      { label: "Smart Invoice", desc: "Voye fakti ak lyen peman", href: "#pwodwi" },
      { label: "Pwodwi & lyen", desc: "Vann sou WhatsApp / Instagram", href: "#pwodwi" },
      { label: "Plugin WooCommerce", desc: "Checkout MonCash nan sit ou", href: "#dev" },
    ],
  },
  {
    label: "Devlopè",
    href: "#dev",
    sub: [
      { label: "API Peman", desc: "REST + webhooks", href: "/developer/docs" },
      { label: "Plugin WooCommerce", desc: "ZIP pre-konfigire", href: "/plugin" },
      { label: "Dokimantasyon", desc: "Quick start & egzanp", href: "/developer/docs" },
    ],
  },
  { label: "Pri", href: "#pri", sub: [] },
  { label: "Sekirite", href: "#sekirite", sub: [] },
  { label: "Sou Nou", href: "/sou-nou", sub: [] },
];

const CHANNELS = [
  {
    icon: FileText,
    title: "Fakti (Smart Invoice)",
    desc: "Kreye yon fakti, jenere yon lyen peman sekirize, epi voye l bay kliyan pa imèl. Li peye sou MonCash — ou resevwa otomatikman sou MonCash oswa NatCash.",
  },
  {
    icon: Package,
    title: "Pwodwi & lyen piblik",
    desc: "Kreye yon pwodwi ak pri, jwenn lyen /p/... epi pataje l sou WhatsApp oswa Instagram. Kliyan peye san kont Hatexcard.",
  },
  {
    icon: Plug,
    title: "WooCommerce",
    desc: "Telechaje plugin MonCash la (ZIP ak kle API). Kliyan checkout sou sit ou an HTG oswa USD — ou resevwa sou MonCash oswa NatCash.",
  },
  {
    icon: Code2,
    title: "API & Webhooks",
    desc: "Entègre nan app oswa sit ou. Kle API, mod live/test, webhooks payment.success, Idempotency-Key — dokiman konplè.",
  },
  {
    icon: Smartphone,
    title: "App Android",
    desc: "Jere kont machann ou sou telefòn: notifikasyon, istorik, fakti, epi konekte MonCash oswa NatCash pou payout.",
  },
  {
    icon: Globe2,
    title: "Payout otomatik",
    desc: "Apre yon peman, rès la ale otomatikman sou nimewo MonCash oswa NatCash (oswa kont bank) ou. Hatexcard pa kenbe yon wallet pou ou.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Ouvri kont + KYC",
    desc: "Enskri gratis, konfime imèl, epi pase verifikasyon KYC — obligatwa pou tout plan.",
  },
  {
    n: "02",
    title: "Konekte MonCash / NatCash",
    desc: "Mare nimewo MonCash oswa NatCash biznis ou pou sistèm nan ka depoze lajan ou otomatikman.",
  },
  {
    n: "03",
    title: "Aksepte peman",
    desc: "Voye fakti, pataje lyen pwodwi, oswa enstale plugin WooCommerce.",
  },
  {
    n: "04",
    title: "Resevwa otomatik",
    desc: "Kliyan peye. Hatexcard pran 2%. Ou resevwa montan ou te mande a sou MonCash oswa NatCash.",
  },
];

const PLANS = [
  {
    id: "free",
    name: "Gratis",
    price: "0",
    tag: "Kòmanse jodi a",
    bullets: [
      "API, fakti, lyen piblik",
      "25 000 HTG / jou",
      "KYC obligatwa",
    ],
    featured: false,
  },
  {
    id: "capacity",
    name: "Kapasite",
    price: "599",
    tag: "Pou biznis k ap grandi",
    bullets: [
      "150 000 HTG / jou",
      "Tout chanèl peman",
      "KYC obligatwa",
    ],
    featured: true,
  },
  {
    id: "premium",
    name: "Premyòm",
    price: "999",
    tag: "Pou gwo biznis",
    bullets: [
      "San limit jou",
      "Plizyè nimewo MonCash / NatCash",
      "KYC obligatwa",
    ],
    featured: false,
  },
];

/** Yon sèl foto demo — retire 3 lòt yo */
const DEMO = {
  img: "/img/hx-demo-payout.png",
  title: "Pasèl MonCash / NatCash pou machann",
  desc: "Kliyan peye an Goud. Ou resevwa otomatikman sou nimewo MonCash oswa NatCash biznis ou — san wallet, san kat vityèl.",
};

const FAQS = [
  {
    q: "Kote lajan kliyan an ale?",
    a: "Kliyan an peye sou MonCash. Hatexcard pran frè pasèl la (2%), epi rès la ale otomatikman sou nimewo MonCash oswa NatCash (oswa kont bank) machann nan. Hatexcard pa kenbe yon wallet pou ou.",
  },
  {
    q: "Kòman m entegre nan sit WooCommerce mwen?",
    a: "Apre KYC, ale nan Plugin, telechaje ZIP la. Kle API a gentan entegre. Enstale nan WordPress → aktive HatexCard MonCash nan WooCommerce → Peman. Checkout sipòte HTG ak USD (ak to konvèsyon). Ou resevwa sou MonCash oswa NatCash.",
  },
  {
    q: "Eske m bezwen yon sit entènèt?",
    a: "Non. Ou ka voye fakti pa imèl oswa pataje yon lyen pwodwi sou WhatsApp / Instagram. WooCommerce ak API yo opsyonèl pou moun ki gen sit oswa app.",
  },
  {
    q: "Konbyen frè a ye?",
    a: "Frè Hatexcard se 2% sou montan machann nan. Gen tou frè transfè MonCash / NatCash (estime ~1%, min 5 HTG). Kliyan an peye frè yo anplis — ou resevwa montan ou te mande a.",
  },
];

/** Foto ak logo Hatexcard anwo agòch (logo ofisyèl) */
function BrandPhoto({
  src,
  alt,
  className = "",
}: Readonly<{ src: string; alt: string; className?: string }>) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img src={src} alt={alt} className="w-full h-full object-cover" />
      <div className="absolute top-3 left-3 flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-lg pl-1.5 pr-2.5 py-1 shadow-sm">
        <img src="/img/hatexcard-logo.png" alt="" className="w-7 h-7 rounded-md object-cover" />
        <span className="text-[12px] font-extrabold tracking-tight text-slate-900">
          Hatex<span className="text-[#1d4ed8]">card</span>
        </span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing min-h-screen bg-[#F7F8FA] text-slate-900 overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap');
        .landing { font-family: 'Outfit', system-ui, sans-serif; }
        .landing .display { font-family: 'Source Serif 4', Georgia, serif; }
        @keyframes land-up {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes land-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .land-a1 { animation: land-up 0.85s cubic-bezier(0.16,1,0.3,1) both; }
        .land-a2 { animation: land-up 0.85s 0.12s cubic-bezier(0.16,1,0.3,1) both; }
        .land-a3 { animation: land-up 0.85s 0.22s cubic-bezier(0.16,1,0.3,1) both; }
        .land-a4 { animation: land-up 0.9s 0.32s cubic-bezier(0.16,1,0.3,1) both; }
        .nav-drop { opacity: 0; pointer-events: none; transform: translateY(8px); transition: all 0.2s ease; }
        .nav-item:hover .nav-drop { opacity: 1; pointer-events: auto; transform: translateY(0); }
      `}</style>

      {/* ═══ NAV (maketing — pa sidebar dashboard) ═══ */}
      <header
        className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(255,255,255,0.94)" : "transparent",
          borderBottom: scrolled ? "1px solid #e5e7eb" : "1px solid transparent",
          backdropFilter: scrolled ? "blur(14px)" : "none",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 h-[68px] flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <img
              src="/img/hatexcard-logo.png"
              alt="Hatexcard"
              className="w-9 h-9 rounded-lg object-cover border border-slate-200 bg-white"
            />
            <span className="text-[19px] font-extrabold tracking-tight text-slate-900">
              Hatex<span className="text-[#1d4ed8]">card</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 flex-1">
            {NAV.map((link) => (
              <div key={link.label} className="nav-item relative px-3 py-2">
                <a
                  href={link.href}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-600 hover:text-slate-900"
                >
                  {link.label}
                  {link.sub.length > 0 && <ChevronDown size={13} />}
                </a>
                {link.sub.length > 0 && (
                  <div className="nav-drop absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-50">
                    {link.sub.map((s) => (
                      <a
                        key={s.label}
                        href={s.href}
                        className="block px-3 py-2.5 rounded-lg hover:bg-slate-50"
                      >
                        <div className="text-[13px] font-bold text-slate-900">{s.label}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{s.desc}</div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-2 ml-auto">
            <Link
              href="/login"
              className="text-[13px] font-bold text-slate-600 hover:text-[#1d4ed8] px-3 py-2"
            >
              Konekte
            </Link>
            <Link
              href="/signup"
              className="text-[13px] font-bold text-white bg-[#1d4ed8] hover:bg-[#1e40af] px-4 py-2.5 rounded-lg shadow-sm transition-colors"
            >
              Kòmanse gratis
            </Link>
          </div>

          <button
            type="button"
            className="lg:hidden ml-auto p-2 text-slate-700"
            aria-label="Meni"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="block w-5 h-0.5 bg-slate-800 mb-1.5" />
            <span className="block w-5 h-0.5 bg-slate-800 mb-1.5" />
            <span className="block w-5 h-0.5 bg-slate-800" />
          </button>
        </div>

        {menuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-200 px-5 py-4 space-y-1">
            {NAV.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block py-3 text-[15px] font-bold text-slate-700 border-b border-slate-100"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 flex flex-col gap-2">
              <Link href="/login" className="text-center py-3 border border-slate-200 rounded-lg font-bold text-sm">
                Konekte
              </Link>
              <Link href="/signup" className="text-center py-3 bg-[#1d4ed8] text-white rounded-lg font-bold text-sm">
                Kòmanse gratis
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══ HERO — yon sèl konpozisyon, brand + headline + CTA + imaj ═══ */}
      <section className="relative pt-[88px] pb-0 overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 90% 60% at 70% 20%, rgba(29,78,216,0.12), transparent 55%), linear-gradient(180deg, #eef2ff 0%, #F7F8FA 55%, #F7F8FA 100%)",
          }}
        />
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(ellipse 70% 50% at 50% 0%, black, transparent)",
          }}
        />

        <div className="max-w-6xl mx-auto px-5 pt-10 lg:pt-16 pb-12 lg:pb-0">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div>
              <p className="land-a1 text-[12px] font-bold uppercase tracking-[0.16em] text-[#1d4ed8] mb-4">
                Hatexcard
              </p>
              <h1 className="land-a2 display text-[clamp(2.4rem,5.5vw,3.75rem)] font-bold leading-[1.08] tracking-tight text-slate-900 mb-5">
                Resevwa peman MonCash / NatCash.{" "}
                <span className="text-[#1d4ed8]">Faster pou biznis ou.</span>
              </h1>
              <p className="land-a3 text-[16px] lg:text-[17px] text-slate-600 leading-relaxed max-w-md mb-8 font-medium">
                Pasèl peman pou machann Ayiti — fakti, lyen pwodwi, WooCommerce ak API.
                Kliyan peye an Goud; ou resevwa otomatikman sou MonCash oswa NatCash.
              </p>
              <div className="land-a4 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-[14px] font-bold px-6 py-3.5 rounded-lg shadow-md shadow-blue-600/20 transition-colors"
                >
                  Kòmanse gratis <ArrowRight size={16} />
                </Link>
                <a
                  href="#demo"
                  className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 text-[14px] font-bold px-6 py-3.5 rounded-lg border border-slate-200 transition-colors"
                >
                  Wè demonstrasyon
                </a>
              </div>
              <p className="land-a4 mt-5 text-[12px] text-slate-500 font-semibold">
                Kont gratis · KYC obligatwa · 2% frè pasèl · Pa gen wallet
              </p>
            </div>

            <div className="land-a4 relative">
              <div className="absolute -inset-4 bg-[#1d4ed8]/10 blur-3xl rounded-full" />
              <BrandPhoto
                src="/img/hx-hero-gateway.png"
                alt="Hatexcard dashboard machann — peman MonCash / NatCash an tan reyèl"
                className="relative w-full rounded-2xl shadow-2xl shadow-slate-900/15 border border-white/60 aspect-[16/10]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TRUST STRIP ═══ */}
      <div className="border-y border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Resevwa sou
          </span>
          {["MonCash", "NatCash", "WooCommerce", "API REST"].map((n) => (
            <span key={n} className="text-[14px] font-extrabold text-slate-300 tracking-wide">
              {n}
            </span>
          ))}
        </div>
      </div>

      {/* ═══ KIJAN LI MACHE ═══ */}
      <section id="kijan" className="py-20 lg:py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-12">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#1d4ed8] mb-3">
              Kijan li mache
            </p>
            <h2 className="display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-tight text-slate-900 mb-3">
              De enskripsyon rive nan kob sou MonCash / NatCash ou
            </h2>
            <p className="text-[15px] text-slate-600 font-medium leading-relaxed">
              Hatexcard se yon pasèl — pa yon bank. Ou resevwa otomatikman sou MonCash oswa NatCash.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <span className="display text-[2.5rem] font-bold text-[#1d4ed8]/15 leading-none">
                  {s.n}
                </span>
                <h3 className="text-[16px] font-bold text-slate-900 mt-2 mb-1.5">{s.title}</h3>
                <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CHANÈL PEMAN (tankou Authorize.net “Make payments a growth engine”) ═══ */}
      <section id="pwodwi" className="py-20 lg:py-24 px-5 bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-12">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#1d4ed8] mb-3">
              Tout fason pou resevwa
            </p>
            <h2 className="display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-tight text-slate-900 mb-3">
              Fè peman vin yon motè kwasans pou biznis ou
            </h2>
            <p className="text-[15px] text-slate-600 font-medium leading-relaxed">
              Chak chanèl konekte ak menm pasèl MonCash / NatCash la — yon sèl kont, plizyè fason pou vann.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
            {CHANNELS.map((c) => (
              <div key={c.title} className="flex gap-4">
                <div className="w-11 h-11 rounded-xl bg-[#eff6ff] text-[#1d4ed8] flex items-center justify-center shrink-0">
                  <c.icon size={20} strokeWidth={1.85} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900 mb-1.5">{c.title}</h3>
                  <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DEMO FOTO — yon sèl foto (retire 3 lòt yo) ═══ */}
      <section id="demo" className="py-20 lg:py-24 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#1d4ed8] mb-3">
              Demonstrasyon
            </p>
            <h2 className="display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-tight text-slate-900 mb-3">
              Wè sa platfòm nan fè
            </h2>
            <p className="text-[15px] text-slate-600 font-medium">
              Kliyan peye — ou resevwa otomatikman sou MonCash oswa NatCash.
            </p>
          </div>

          <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <BrandPhoto
              src={DEMO.img}
              alt={DEMO.title}
              className="w-full aspect-[16/9]"
            />
            <figcaption className="p-5 sm:p-6 border-t border-slate-100">
              <h3 className="text-[16px] font-bold text-slate-900">{DEMO.title}</h3>
              <p className="text-[13px] text-slate-600 mt-1.5 font-medium leading-relaxed">{DEMO.desc}</p>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ═══ DEV / PLUGIN ═══ */}
      <section id="dev" className="py-20 lg:py-24 px-5 bg-[#0b1220] text-white">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-blue-300 mb-3">
              Pou devlopè & boutik
            </p>
            <h2 className="display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-tight mb-4">
              Plugin WooCommerce + API ki pare pou pwodiksyon
            </h2>
            <p className="text-[15px] text-slate-300 leading-relaxed font-medium mb-6">
              Enstale plugin MonCash nan 5 minit, oswa entegre API REST ak webhooks.
              Kle API hash, rotate, MFA, ak mod live/test.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "ZIP WooCommerce ak kle API entegre",
                "Checkout blòk WooCommerce (WC 8.3+)",
                "HTG oswa USD → HTG ak to konvèsyon",
                "Webhooks payment.success (HMAC)",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[13px] font-medium text-slate-200">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/developer/docs"
                className="inline-flex items-center gap-2 bg-white text-slate-900 text-[13px] font-bold px-5 py-3 rounded-lg hover:bg-slate-100"
              >
                Dokimantasyon API
              </Link>
              <Link
                href="/plugin"
                className="inline-flex items-center gap-2 border border-white/25 text-white text-[13px] font-bold px-5 py-3 rounded-lg hover:bg-white/10"
              >
                Plugin WooCommerce
              </Link>
            </div>
          </div>
          <div className="relative max-w-md mx-auto">
            <BrandPhoto
              src="/img/hx-demo-woocommerce.png"
              alt="Plugin WooCommerce Hatexcard — Peye ak Hatexcard, resevwa sou MonCash / NatCash"
              className="w-full rounded-2xl border border-white/10 shadow-2xl aspect-square"
            />
          </div>
        </div>
      </section>

      {/* ═══ PRI ═══ */}
      <section id="pri" className="py-20 lg:py-24 px-5 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#1d4ed8] mb-3">
              Pri transparan
            </p>
            <h2 className="display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-tight text-slate-900 mb-3">
              Frè ki klè. Plan ki senp.
            </h2>
            <p className="text-[15px] text-slate-600 font-medium">
              2% frè pasèl sou chak peman. Kliyan peye frè yo anplis — ou resevwa montan ou mande a.
              Apre sa, chwazi yon plan selon limit jou ou bezwen.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`rounded-2xl p-6 border ${
                  p.featured
                    ? "bg-[#1d4ed8] text-white border-[#1d4ed8] shadow-xl shadow-blue-600/20 scale-[1.02]"
                    : "bg-[#F7F8FA] border-slate-200 text-slate-900"
                }`}
              >
                <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${p.featured ? "text-blue-100" : "text-slate-500"}`}>
                  {p.tag}
                </p>
                <h3 className="text-[20px] font-extrabold mb-1">{p.name}</h3>
                <p className="mb-5">
                  <span className="text-[2rem] font-extrabold">{p.price}</span>
                  <span className={`text-[13px] font-semibold ml-1 ${p.featured ? "text-blue-100" : "text-slate-500"}`}>
                    HTG / mwa
                  </span>
                </p>
                <ul className="space-y-2.5 mb-6">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-[13px] font-medium">
                      <CheckCircle2
                        size={15}
                        className={`shrink-0 mt-0.5 ${p.featured ? "text-blue-100" : "text-[#1d4ed8]"}`}
                      />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`block text-center text-[13px] font-bold py-3 rounded-lg transition-colors ${
                    p.featured
                      ? "bg-white text-[#1d4ed8] hover:bg-blue-50"
                      : "bg-[#1d4ed8] text-white hover:bg-[#1e40af]"
                  }`}
                >
                  Chwazi {p.name}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-[12px] text-slate-500 font-medium mt-8 max-w-lg mx-auto">
            Anplis: frè transfè MonCash / NatCash (estime ~1%, min 5 HTG) ajoute sou bò kliyan an.
            Pa gen frè kache sou kont gratis la.
          </p>
        </div>
      </section>

      {/* ═══ SEKIRITE ═══ */}
      <section id="sekirite" className="py-20 lg:py-24 px-5">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#1d4ed8] mb-3">
              Sekirite
            </p>
            <h2 className="display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-tight text-slate-900 mb-4">
              Pwoteksyon ki konte pou lajan w
            </h2>
            <p className="text-[15px] text-slate-600 font-medium leading-relaxed mb-8">
              KYC obligatwa pou tout plan (Gratis, Kapasite, Premyòm). Nou verifye idantite anvan ou resevwa lajan.
            </p>
            <div className="space-y-5">
              {[
                {
                  icon: ShieldCheck,
                  t: "KYC obligatwa (tout plan)",
                  d: "Dokiman ID, selfie ak liveness — menm sou plan Gratis. Sa redwi fwòd sou platfòm nan.",
                },
                {
                  icon: Lock,
                  t: "Kle API + MFA",
                  d: "Kle sekrè hash, rotate, ak MFA (TOTP) pou aksè API. Webhooks siyen ak HMAC.",
                },
                {
                  icon: Zap,
                  t: "Limit jou & kontwòl",
                  d: "Plan Gratis / Kapasite / Premyòm kontwole konbyen ou ka resevwa chak jou.",
                },
              ].map((item) => (
                <div key={item.t} className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <item.icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-slate-900">{item.t}</h3>
                    <p className="text-[13px] text-slate-600 font-medium leading-relaxed mt-0.5">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <BrandPhoto
              src="/img/hx-demo-kyc.png"
              alt="KYC obligatwa, SSL 256-bit, MFA — sekirite Hatexcard"
              className="w-full rounded-2xl border border-slate-200 shadow-lg aspect-square"
            />
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="py-20 px-5 bg-white border-y border-slate-200">
        <div className="max-w-2xl mx-auto">
          <h2 className="display text-center text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-tight text-slate-900 mb-8">
            Kesyon yo poze souvan
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => {
              const open = activeFaq === i;
              return (
                <button
                  key={faq.q}
                  type="button"
                  onClick={() => setActiveFaq(open ? null : i)}
                  className={`w-full text-left border rounded-xl px-5 py-4 transition-colors ${
                    open ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-[14px] font-bold ${open ? "text-[#1d4ed8]" : "text-slate-900"}`}>
                      {faq.q}
                    </span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 transition-transform ${open ? "rotate-180 text-[#1d4ed8]" : "text-slate-400"}`}
                    />
                  </div>
                  {open && (
                    <p className="mt-3 text-[13px] text-slate-600 font-medium leading-relaxed">{faq.a}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section className="py-20 lg:py-24 px-5">
        <div className="max-w-4xl mx-auto text-center bg-[#0b1220] rounded-3xl px-6 py-14 lg:py-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(29,78,216,0.35),transparent_55%)]" />
          <div className="relative z-10">
            <h2 className="display text-[clamp(1.8rem,4vw,2.75rem)] font-bold text-white tracking-tight mb-4">
              Pare pou resevwa peman an Goud?
            </h2>
            <p className="text-[15px] text-slate-300 font-medium max-w-lg mx-auto mb-8">
              Ouvri yon kont gratis, pase KYC, konekte MonCash oswa NatCash, epi voye premye fakti ou oswa enstale plugin la.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-[14px] font-bold px-6 py-3.5 rounded-lg"
              >
                Ouvri kont gratis
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 border border-white/20 text-white text-[14px] font-bold px-6 py-3.5 rounded-lg hover:bg-white/10"
              >
                Konekte
              </Link>
              <a
                href="/HatexCard.apk"
                download="HatexCard_v1.0.apk"
                className="inline-flex items-center gap-2 border border-white/20 text-white text-[14px] font-bold px-6 py-3.5 rounded-lg hover:bg-white/10"
              >
                <Smartphone size={16} /> App Android
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-5 py-14">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <img src="/img/hatexcard-logo.png" alt="" className="w-8 h-8 rounded-lg border border-slate-200" />
                <span className="font-extrabold text-[17px]">
                  Hatex<span className="text-[#1d4ed8]">card</span>
                </span>
              </div>
              <p className="text-[13px] text-slate-600 font-medium leading-relaxed max-w-xs">
                Pasèl peman MonCash / NatCash pou machann Ayiti. Fakti, lyen pwodwi, WooCommerce, ak API — 100% an Goud.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-900 mb-3">Pwodwi</p>
              <ul className="space-y-2 text-[13px] font-medium text-slate-600">
                <li><a href="#pwodwi" className="hover:text-[#1d4ed8]">Fakti</a></li>
                <li><a href="#pwodwi" className="hover:text-[#1d4ed8]">Pwodwi & lyen</a></li>
                <li><Link href="/plugin" className="hover:text-[#1d4ed8]">Plugin WooCommerce</Link></li>
                <li><Link href="/developer" className="hover:text-[#1d4ed8]">API</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-900 mb-3">Konpayi</p>
              <ul className="space-y-2 text-[13px] font-medium text-slate-600">
                <li><Link href="/sou-nou" className="hover:text-[#1d4ed8]">Sou Nou</Link></li>
                <li><Link href="/support" className="hover:text-[#1d4ed8]">Sipò</Link></li>
                <li><Link href="/blog" className="hover:text-[#1d4ed8]">Blog</Link></li>
                <li><a href="mailto:support@hatexcard.com" className="hover:text-[#1d4ed8]">Kontakte</a></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-900 mb-3">Legal</p>
              <ul className="space-y-2 text-[13px] font-medium text-slate-600">
                <li><Link href="/terms" className="hover:text-[#1d4ed8]">Kondisyon / Akò Sèvis</Link></li>
                <li><Link href="/politik" className="hover:text-[#1d4ed8]">Konfidansyalite</Link></li>
                <li><Link href="/terms#s7" className="hover:text-[#1d4ed8]">KYC & AML</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-slate-500 font-medium">
              © {new Date().getFullYear()} Hatexcard. Tout dwa rezève.
            </p>
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Platfòm operasyonèl · MonCash & NatCash
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
