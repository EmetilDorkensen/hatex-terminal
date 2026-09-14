"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Code2,
  FileText,
  Package,
  Plug,
  Smartphone,
  ShieldCheck,
  Banknote,
  Webhook,
  CreditCard,
  Globe2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

/**
 * Paj Konpayi — Sou Nou.
 * Stil klè (menm jan ak landing page la): fon #F7F8FA, aksan ble #1d4ed8.
 */

const WHAT_WE_DO = [
  {
    icon: Banknote,
    title: "Pasèl peman MonCash",
    desc: "Kliyan peye an Goud (HTG). Ou resevwa sou nimewo MonCash ou — san wallet HatexCard ki kenbe lajan ou.",
  },
  {
    icon: FileText,
    title: "Smart Invoice",
    desc: "Kreye fakti, jenere lyen peman sekirize, voye bay kliyan. Yo peye sou telefòn yo; ou resevwa otomatikman.",
  },
  {
    icon: Package,
    title: "Pwodwi & lyen piblik",
    desc: "Mete yon pwodwi ak pri, pataje /p/... sou WhatsApp oswa Instagram. Checkout san konplikasyon.",
  },
  {
    icon: Plug,
    title: "Plugin WooCommerce",
    desc: "Enstale ZIP pre-konfigire a. Kliyan checkout sou sit ou; lajan an ale sou MonCash ou.",
  },
  {
    icon: Code2,
    title: "API & Webhooks",
    desc: "REST API (test / live), Idempotency-Key, webhooks payment.success ak siyati HMAC — tankou estanda mondyal yo.",
  },
  {
    icon: ShieldCheck,
    title: "KYC, MFA & sekirite",
    desc: "Verifikasyon ID obligatwa, 2FA (MFA), kle API separe test/live, epi rotate kle ak kòd MFA.",
  },
  {
    icon: Smartphone,
    title: "App Android",
    desc: "Jere kont machann ou sou telefòn: notifikasyon, istorik, fakti, ak koneksyon payout.",
  },
  {
    icon: Webhook,
    title: "Notifikasyon otomatik",
    desc: "Imèl + webhook lè peman an konfime — sit ou ak bwat ou konnen nan menm moman an.",
  },
];

const ROADMAP = [
  {
    icon: Smartphone,
    title: "NatCash nèt",
    desc: "Aksepte NatCash tankou MonCash — plis opsyon pou kliyan, menm pasèl pou machann.",
    tag: "Ap vini",
  },
  {
    icon: CreditCard,
    title: "Kat bank (Visa / Mastercard)",
    desc: "Peman kat entènasyonal atravè patnè (egzanp Stripe) pou kliyan ki pa gen MonCash.",
    tag: "Talè",
  },
  {
    icon: Globe2,
    title: "Plis entegrasyon e-commerce",
    desc: "Sipò pou lòt platfòm boutik ak zouti ki fasilite antrepriz ki deja gen sit yo.",
    tag: "Planifye",
  },
  {
    icon: Sparkles,
    title: "Eksperyans peman pi senp",
    desc: "USSD dirèk sou telefòn, checkout pi rapid, mwens friksyon — toujou san kite sit ou.",
    tag: "An kou",
  },
];

export default function SouNouPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900 font-sans selection:bg-blue-100 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-5xl mx-auto p-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:text-[#1d4ed8] hover:bg-slate-50 transition-colors shadow-sm"
            aria-label="Retounen"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <img
              src="/img/hatexcard-logo.png"
              alt=""
              className="w-8 h-8 rounded-lg border border-slate-200 object-cover"
            />
            <span className="font-extrabold text-[16px] tracking-tight">
              Hatex<span className="text-[#1d4ed8]">card</span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 border-l border-slate-200 pl-3 ml-1">
              Konpayi
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-5 md:p-8 mt-6">
        {/* Hero */}
        <p className="text-[#1d4ed8] text-xs font-extrabold uppercase tracking-[0.25em] mb-3">
          Sou Nou
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-[1.05]">
          HatexCard — pasèl peman pou <span className="text-[#1d4ed8]">Ayiti</span>
        </h1>
        <p className="text-slate-600 text-base md:text-lg font-medium max-w-2xl mb-4 leading-relaxed">
          Nou ede machann ak sit web resevwa lajan an Goud (HTG). Kliyan peye ak
          MonCash; ou resevwa sou kont MonCash ou — rapid, an sekirite, san
          konplikasyon bank tradisyonèl.
        </p>
        <p className="text-slate-500 text-sm font-semibold italic border-l-4 border-[#1d4ed8] pl-4 mb-14">
          Yon tranzaksyon alafwa. Yon ekonomi ki pi ouvè.
        </p>

        {/* Kiyès */}
        <section className="bg-white p-7 md:p-8 rounded-2xl border border-slate-200 shadow-sm mb-10">
          <h2 className="text-lg font-extrabold uppercase tracking-widest text-slate-900 mb-4">
            Kiyès nou ye
          </h2>
          <p className="text-slate-600 leading-relaxed text-[15px]">
            HatexCard se yon konpayi teknoloji finansye ki bati pou reyalite mache
            ayisyen an. Nou pa yon bank, epi nou pa kenbe yon wallet pou ou: nou se{" "}
            <strong className="text-slate-900">pasèl la</strong> ant sit / boutik ou
            ak MonCash. Apre KYC, ou konekte nimewo biznis ou, epi ou ka voye fakti,
            vann pwodwi, enstale WooCommerce, oswa entegre API nou an.
          </p>
        </section>

        {/* Sa nou fè */}
        <section className="mb-14">
          <div className="mb-6 border-b border-slate-200 pb-4">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Sa nou fè
            </h2>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              Pwodwi ki deja aktif pou machann yo jodi a.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {WHAT_WE_DO.map((item) => (
              <div
                key={item.title}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-[#1d4ed8]/40 hover:shadow-md transition-all"
              >
                <div className="w-11 h-11 bg-blue-50 text-[#1d4ed8] rounded-xl flex items-center justify-center mb-4 border border-blue-100">
                  <item.icon size={20} />
                </div>
                <h3 className="font-extrabold text-[15px] text-slate-900 mb-1.5">
                  {item.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Sa nou prevwa */}
        <section className="mb-14">
          <div className="mb-6 border-b border-slate-200 pb-4">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Sa nou prevwa fè
            </h2>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              Roadmap — sa k ap vini pou elaji opsyon peman ak entegrasyon.
            </p>
          </div>
          <div className="space-y-4">
            {ROADMAP.map((item) => (
              <div
                key={item.title}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-start hover:border-[#1d4ed8]/40 transition-all"
              >
                <div className="w-12 h-12 shrink-0 bg-blue-50 text-[#1d4ed8] rounded-xl flex items-center justify-center border border-blue-100">
                  <item.icon size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-extrabold text-[15px] text-slate-900">
                      {item.title}
                    </h3>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-[#1d4ed8] border border-blue-200">
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed font-medium">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Misyon / Vizyon */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
          <div className="bg-[#0b1220] p-8 rounded-2xl text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(29,78,216,0.35),transparent_55%)]" />
            <div className="relative z-10">
              <h2 className="text-base font-extrabold uppercase tracking-widest mb-3">
                Misyon
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed font-medium">
                Fasilite komès lokal: bay antreprenè ak machann yon mwayen senp pou
                resevwa lajan 100% an Goud, ak zouti (fakti, lyen, API, plugin) ki
                mache ak fason Ayiti deja peye — MonCash.
              </p>
            </div>
          </div>
          <div className="bg-[#0b1220] p-8 rounded-2xl text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(29,78,216,0.35),transparent_55%)]" />
            <div className="relative z-10">
              <h2 className="text-base font-extrabold uppercase tracking-widest mb-3">
                Vizyon
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed font-medium">
                Vin pasèl peman referans nan peyi a: chak ti biznis ka vann sou
                entènèt oswa WhatsApp, epi chak kliyan ka peye san baryè — ak plis
                metòd (NatCash, kat) nan tan k ap vini an.
              </p>
            </div>
          </div>
        </section>

        {/* Poukisa */}
        <section className="bg-blue-50 border border-blue-100 p-7 md:p-8 rounded-2xl mb-12">
          <h2 className="text-base font-extrabold uppercase tracking-widest text-slate-900 mb-4">
            Poukisa HatexCard
          </h2>
          <ul className="space-y-3">
            {[
              "100% an Goud (HTG) — pa gen konvèsyon USD fòse.",
              "Ou resevwa dirèk sou MonCash ou — nou pa kenbe lajan ou.",
              "KYC + MFA pou pwoteje kont ak kle API.",
              "Dokiman API, webhooks, ak plugin pou sit ou.",
            ].map((line) => (
              <li
                key={line}
                className="flex items-start gap-3 text-sm text-slate-700 font-medium"
              >
                <CheckCircle2 className="text-[#1d4ed8] shrink-0 mt-0.5" size={16} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-6 py-4 rounded-xl font-bold text-sm transition-all shadow-sm"
          >
            Ouvri kont gratis
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/developer/docs"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 px-6 py-4 rounded-xl font-bold text-sm transition-all shadow-sm"
          >
            Dokiman API
          </Link>
          <Link
            href="/kontakte"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-6 py-4 rounded-xl font-bold text-sm transition-all shadow-sm"
          >
            Kontakte nou
          </Link>
        </div>
      </div>
    </div>
  );
}
