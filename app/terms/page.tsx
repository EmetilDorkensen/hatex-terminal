"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Building2,
  Lock,
  Scale,
} from "lucide-react";

/**
 * AKÒ SÈVIS AK KONDISYON ITILIZASYON HATEXCARD
 * Fòma ofisyèl — modèl Payment Gateway Merchant Services Agreement
 * (Authorize.Net style) pou yon pasèl « pass-through ».
 */

const TOC = [
  { id: "s1", label: "1. Deskripsyon Sèvis la" },
  { id: "s2", label: "2. Absans Tranzisyon Fon" },
  { id: "s3", label: "3. Dispit, Ranbousman & Fwod" },
  { id: "s4", label: "4. Sekirite & API" },
  { id: "s5", label: "5. Limitasyon Responsablite" },
  { id: "s6", label: "6. Fèmen Kont & Revokasyon" },
  { id: "s7", label: "7. KYC / AML" },
  { id: "s8", label: "8. Frè & Plan" },
  { id: "s9", label: "9. Payout MonCash / NatCash" },
  { id: "s10", label: "10. Relasyon Bipati (Bank)" },
  { id: "s11", label: "11. Aktivite Entèdi" },
  { id: "s12", label: "12. Responsablite Machann" },
  { id: "s13", label: "13. Done & Konfidansyalite" },
  { id: "s14", label: "14. Pwopriyete Entèlektyèl" },
  { id: "s15", label: "15. Endemnizasyon" },
  { id: "s16", label: "16. Lwa ki Gouvène" },
  { id: "s17", label: "17. Definisyon" },
  { id: "s18", label: "18. Kontak" },
];

export default function TermsPage() {
  const router = useRouter();
  const [active, setActive] = useState("s1");

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-700 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-[#1d4ed8]"
            aria-label="Retounen"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/img/hatexcard-logo.png"
              alt=""
              className="w-8 h-8 rounded-lg border border-slate-200 object-cover"
            />
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-slate-900 truncate">
                Hatex<span className="text-[#1d4ed8]">card</span>
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Akò Sèvis · Payment Gateway
              </p>
            </div>
          </div>
          <Link
            href="/politik"
            className="ml-auto text-[12px] font-bold text-[#1d4ed8] hover:underline shrink-0"
          >
            Politik Konfidansyalite
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12 grid lg:grid-cols-[240px_1fr] gap-8">
        {/* TOC */}
        <aside className="hidden lg:block">
          <nav className="sticky top-20 space-y-0.5 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 px-2">
              Tabel Kontni
            </p>
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setActive(item.id)}
                className={`block px-2 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
                  active === item.id
                    ? "bg-blue-50 text-[#1d4ed8]"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Body */}
        <article className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#0b1220] text-white px-6 sm:px-10 py-10">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-blue-300 mb-4">
              <FileText size={14} /> Merchant Services Agreement
            </div>
            <h1 className="text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold tracking-tight leading-tight mb-3">
              Akò Sèvis ak Kondisyon Itilizasyon HatexCard
            </h1>
            <p className="text-[14px] text-slate-300 max-w-2xl leading-relaxed font-medium">
              Akò legal ant ou (« Machann » / « Kliyan ») ak HatexCard, yon antrepriz
              teknolojik ki fonde epi dirije pa <strong className="text-white">Dorkensen Emetil</strong>.
              Li gouvène itilizasyon pasèl peman (Payment Gateway) HatexCard.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-[11px] font-bold uppercase tracking-wider">
              <span className="bg-white/10 border border-white/15 px-3 py-1.5 rounded-full">
                Vigè: 10 Septanm 2026
              </span>
              <span className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 px-3 py-1.5 rounded-full">
                Modèl Pass-Through Gateway
              </span>
              <span className="bg-white/10 border border-white/15 px-3 py-1.5 rounded-full">
                Pa yon bank · Pa yon wallet
              </span>
            </div>
          </div>

          <div className="px-6 sm:px-10 py-8 space-y-12 text-[14px] leading-relaxed">
            {/* Notice */}
            <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <p className="text-amber-900 text-[13px] font-medium">
                <strong>Li akò sa a ak atansyon.</strong> Lè ou kreye yon kont, pase KYC,
                itilize API a, Plugin WooCommerce, Fakti, oswa nenpòt sèvis HatexCard,
                ou aksepte tout kondisyon sa yo. Si ou pa dakò, pa itilize sèvis la.
              </p>
            </div>

            {/* 1 */}
            <section id="s1">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  1
                </span>
                Deskripsyon Sèvis la (Lojisyèl kòm Pasèl)
              </h2>
              <p className="mb-3">
                HatexCard ofri yon <strong>pasèl peman (Payment Gateway)</strong> ki pèmèt
                machann yo kominike ak founisè sèvis peman yo (tankou rezo mobil MonCash /
                NatCash ak, nan vizyon alontèm, bank lokal yo). HatexCard se yon{" "}
                <strong>founisè solisyon teknolojik ak woutaj done</strong> sèlman.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>Nou <strong>pa</strong> yon bank.</li>
                <li>Nou <strong>pa</strong> yon enstitisyon lajan elektwonik (EMI).</li>
                <li>
                  Nou <strong>pa</strong> ofri sèvis depo, wallet, ni jesyon fon pou machann
                  ni pou achtè.
                </li>
                <li>
                  Sèvis yo enkli: API peman, Plugin WooCommerce, Smart Invoice, lyen pwodwi,
                  dashboard, webhooks, ak zouti KYC.
                </li>
              </ul>
            </section>

            {/* 2 */}
            <section id="s2">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  2
                </span>
                Transmisyon Done ak Absans Tranzisyon Fon
              </h2>
              <p className="mb-3">
                Sèvis nou an limite a <strong>ankripte ak transmèt done tranzaksyon</strong> ant
                sit / aplikasyon machann nan ak founisè sèvis peman yo.
              </p>
              <p className="mb-3">
                Lajan tranzaksyon yo deplase <strong>sèlman e dirèkteman</strong> ant kont
                achtè a ak kont machann nan (MonCash, NatCash, oswa kont bank machann nan).
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[13px] font-semibold text-slate-800">
                Nan okenn moman HatexCard pa posede, kontwole, estoke, ni kenbe lajan sa yo.
                Sa se yon modèl <em>pass-through gateway</em> — menm prensip ak Authorize.Net.
              </div>
            </section>

            {/* 3 */}
            <section id="s3">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  3
                </span>
                Jere Dispit, Ranbousman (Refunds) ak Fwod
              </h2>
              <p className="mb-3">
                Kòm HatexCard pa kenbe lajan an, nou <strong>pa gen kapasite teknik ni legal</strong>{" "}
                pou ranbouse achtè yo oswa anile yon tranzaksyon ki deja reyisi nan rezo
                founisè peman an.
              </p>
              <h3 className="font-bold text-slate-900 mt-5 mb-2">3.1 Responsablite Machann nan</h3>
              <p className="mb-2">
                Machann nan dakò se li menm sèl ki responsab pou tout ranbousman, plent, ak
                pwodwi / sèvis li pa livre. Machann nan dwe gen yon{" "}
                <strong>politik ranbousman klè</strong> sou pwòp sit li oswa nan kominikasyon
                ak kliyan li.
              </p>
              <h3 className="font-bold text-slate-900 mt-5 mb-2">3.2 Wòl HatexCard</h3>
              <p>
                Si nou resevwa anpil plent pou fwòd sou yon machann, HatexCard gen{" "}
                <strong>dwa absoli</strong> pou sispann oswa anile aksè machann sa a nan API a /
                kont la imedyatman pou pwoteje rezo a, san avètisman prealable si nesesè.
              </p>
            </section>

            {/* 4 */}
            <section id="s4">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  4
                </span>
                Sekirite ak Itilizasyon API a
              </h2>
              <p className="mb-3">
                Machann nan resevwa yon <strong>Kle API pèsonèl</strong> (ak, kote aplikab,
                kle publishable, webhook secret, MFA). Li responsab pou kenbe kle sa yo sekrè.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600 mb-3">
                <li>Pa pataje kle API nan kòd kliyan (frontend), Git piblik, ni ak twazyèm pati.</li>
                <li>Rotate kle a imedyatman si ou sispèk yon fwit.</li>
                <li>Ou responsab pou tout tranzaksyon ki fèt ak kle ou yo.</li>
              </ul>
              <p>
                Machann nan <strong>pa gen dwa</strong> itilize API HatexCard la pou okenn
                aktivite ilegal — gade Seksyon 11.
              </p>
            </section>

            {/* 5 */}
            <section id="s5">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  5
                </span>
                Limitasyon Responsablite (« As-Is » Clause)
              </h2>
              <p className="mb-3">
                Sèvis HatexCard yo ofri <strong>« jan yo ye a » (As-Is)</strong> san okenn
                garanti absoli ke sistèm nan p ap janm gen pann (pa gen garanti uptime 100%).
              </p>
              <p>
                HatexCard, fondatè li (<strong>Dorkensen Emetil</strong>), ak anplwaye / ajan
                li yo <strong>pa responsab</strong> pou okenn pèt finansye, mank de pwofi,
                pèt done, oswa domaj ki koze pa: pann nan rezo founisè peman yo (Digicel /
                MonCash, Natcom / NatCash, bank yo), erè machann nan, fwòd twazyèm pati, fòs
                majè, oswa itilizasyon ki pa konfòm ak akò sa a.
              </p>
            </section>

            {/* 6 */}
            <section id="s6">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  6
                </span>
                Fèmen Kont ak Revokasyon
              </h2>
              <p className="mb-3">
                HatexCard ka mete fen nan akò sa a epi koupe aksè machann nan{" "}
                <strong>nenpòt ki lè</strong> san avètisman si machann nan vyole nenpòt nan
                règ sa yo, sitou an ka de sispèk skam, fwòd, oswa move itilizasyon teknoloji a.
              </p>
              <p>
                Ou ka mande fèmti kont ou pa ekri bay sipò. Fèmti pa efase obligasyon ki deja
                egziste (frè, plent, vyolasyon).
              </p>
            </section>

            {/* 7 KYC */}
            <section id="s7">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  7
                </span>
                KYC / AML — Obligatwa pou Tout Plan
              </h2>
              <p className="mb-3">
                Verifikasyon idantite (<strong>KYC</strong>) ak kontwòl anti-blanchiman
                (<strong> AML</strong>) obligatwa pou{" "}
                <strong>tout plan</strong> — inkliziv Plan Gratis, Kapasite, ak Premyòm —
                anvan ou ka resevwa peman live, telechaje Plugin, oswa jenere kle API live.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>Ou dwe bay enfòmasyon veridik (ID, selfie / liveness, done biznis).</li>
                <li>Enfòmasyon fo oswa dokiman fo = sispansyon imedyat.</li>
                <li>
                  HatexCard ka mande dokiman siplemantè nenpòt ki lè pou konfòmite AML.
                </li>
                <li>Ou dwe gen omwen 18 an epi pa sou lis sanksyon entènasyonal.</li>
              </ul>
            </section>

            {/* 8 Fees */}
            <section id="s8">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  8
                </span>
                Frè, Plan ak Limit Jou
              </h2>
              <p className="mb-3">
                Sof si yon akò ekri diferan, frè pasèl HatexCard se{" "}
                <strong>2%</strong> sou montan machann nan mande a. Frè founisè peman
                (transfè MonCash / NatCash, estime ~1%, min. 5 HTG) ajoute sou bò achtè a —
                machann nan resevwa montan li te mande a.
              </p>
              <div className="overflow-x-auto border border-slate-200 rounded-xl mb-3">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Pri / mwa</th>
                      <th className="px-4 py-3">Limit jou</th>
                      <th className="px-4 py-3">KYC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-4 py-3 font-bold text-slate-900">Gratis</td>
                      <td className="px-4 py-3">0 HTG</td>
                      <td className="px-4 py-3">25 000 HTG</td>
                      <td className="px-4 py-3">Obligatwa</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-bold text-slate-900">Kapasite</td>
                      <td className="px-4 py-3">599 HTG</td>
                      <td className="px-4 py-3">150 000 HTG</td>
                      <td className="px-4 py-3">Obligatwa</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-bold text-slate-900">Premyòm</td>
                      <td className="px-4 py-3">999 HTG</td>
                      <td className="px-4 py-3">San limit jou*</td>
                      <td className="px-4 py-3">Obligatwa</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[12px] text-slate-500">
                *Sijè a kapasite kont MonCash / NatCash machann nan. HatexCard ka modifye
                frè ak plan yo avèk avètisman sou sit la oswa nan dashboard.
              </p>
            </section>

            {/* 9 Payout */}
            <section id="s9">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  9
                </span>
                Payout Otomatik — MonCash / NatCash
              </h2>
              <p className="mb-3">
                Pou resevwa lajan otomatikman, machann nan dwe konekte omwen yon nimewo{" "}
                <strong>MonCash</strong> oswa <strong>NatCash</strong> (oswa, kote disponib,
                yon kont bank). Apre yon peman reyisi, sistèm nan eseye depoze montan machann
                nan sou nimewo / kont sa a.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>
                  Si kont mobil la plen oswa transfè a echwe, HatexCard ka kenbe esè yo an
                  atant epi notifye machann nan — san sa pa vle di HatexCard kenbe yon wallet
                  pou ou.
                </li>
                <li>
                  Ou responsab pou verifye nimewo yo kòrèk. Yon nimewo fo ka lakòz pèt lajan
                  ou pa ka rekipere.
                </li>
                <li>
                  Plan Premyòm ka pèmèt plizyè nimewo — sistèm nan eseye youn apre lòt.
                </li>
              </ul>
            </section>

            {/* 10 Bipartite banks */}
            <section id="s10">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  10
                </span>
                Relasyon Bipati ak Bank (Vizyon Authorize.Net)
              </h2>
              <p className="mb-3 flex items-start gap-2">
                <Building2 className="text-[#1d4ed8] shrink-0 mt-0.5" size={18} />
                <span>
                  Pou entegrasyon kat kredi / debi ak bank lokal yo (SOGEBANK, UNIBANK, BUH,
                  elatriye), HatexCard itilize apwòch{" "}
                  <strong>Relasyon Bipati (Bipartite)</strong> — separe kont teknoloji a ak
                  kont lajan an:
                </span>
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-slate-600 mb-3">
                <li>
                  Machann nan ouvri yon <strong>Merchant Account</strong> (kont e-commerce)
                  nan bank li a, nan non biznis li.
                </li>
                <li>
                  Machann nan kreye yon <strong>Gateway Account</strong> sou HatexCard.
                </li>
                <li>
                  Machann nan ploge idantifyan bank lan (Merchant ID / kle) nan tablodbò
                  HatexCard.
                </li>
                <li>
                  HatexCard sèvi kòm <strong>pon API</strong> ant sit machann nan ak sèvè
                  bank lan. Lajan an soti nan kat achtè a tonbe{" "}
                  <strong>dirèk nan bank machann nan</strong>.
                </li>
              </ol>
              <p className="text-[13px] font-semibold text-slate-800 bg-blue-50 border border-blue-100 rounded-xl p-4">
                HatexCard ofri sèvis teknoloji a; bank lan ofri sèvis lajan an. Sa pèmèt
                HatexCard fè menm wòl Authorize.Net san li pa vin yon bank ni kenbe fon.
              </p>
            </section>

            {/* 11 Prohibited */}
            <section id="s11">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  11
                </span>
                Aktivite Entèdi
              </h2>
              <p className="mb-2">Ou pa gen dwa itilize HatexCard pou:</p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>Vant zam, dwòg ilegal, oswa pwodwi restriksyonèl</li>
                <li>Ponzi, piramid, skam, phishing, oswa fwòd</li>
                <li>Blanchiman lajan oswa finansman aktivite ilegal</li>
                <li>Kontni adilt ilegal, exploitage minè, oswa trafik moun</li>
                <li>Nenpòt bagay lalwa Ayisyen oswa lwa entènasyonal kondane</li>
                <li>Eskive KYC, limite jou, oswa kontwòl AML</li>
              </ul>
            </section>

            {/* 12 Merchant duties */}
            <section id="s12">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  12
                </span>
                Responsablite Machann nan (Siplemantè)
              </h2>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>Livre pwodwi / sèvis ou vann nan yon delè rezonab.</li>
                <li>Kenbe dokiman fiskal ak legal biznis ou an règle.</li>
                <li>Respekte règle PCI DSS kote yo aplike (pa estoke done kat sou sèvè ou san otorizasyon).</li>
                <li>Pa reprezante HatexCard kòm bank ou kòm detantè fon ou.</li>
                <li>Notifye sipò imedyatman an ka de fwòd oswa aksè non otorize.</li>
              </ul>
            </section>

            {/* 13 Privacy */}
            <section id="s13">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  13
                </span>
                Done & Konfidansyalite
              </h2>
              <p className="mb-3">
                Tratman done pèsonèl (KYC, tranzaksyon, teknik) gouvène pa{" "}
                <Link href="/politik" className="text-[#1d4ed8] font-bold hover:underline">
                  Politik Konfidansyalite HatexCard
                </Link>
                . Nou ka pataje done ak founisè peman, bank, oswa otorite lalwa lè sa
                obligatwa pou egzekite yon tranzaksyon oswa pou konfòmite.
              </p>
              <p className="flex items-start gap-2 text-[13px]">
                <Lock size={16} className="text-[#1d4ed8] shrink-0 mt-0.5" />
                Kle API yo estoke hash kote posib; webhook yo siyen (HMAC). Ou dwe pwoteje
                aksè kont ou (modpas, MFA).
              </p>
            </section>

            {/* 14 IP */}
            <section id="s14">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  14
                </span>
                Pwopriyete Entèlektyèl
              </h2>
              <p>
                Logo, mak, kòd, dokiman, ak platfòm HatexCard rete pwopriyete HatexCard /
                Dorkensen Emetil. Ou resevwa yon lisans limite, non-eksklizif, revokab pou
                itilize sèvis yo selon akò sa a — pa gen dwa revann, kopi, oswa engenye
                envès san otorizasyon ekri.
              </p>
            </section>

            {/* 15 Indemnity */}
            <section id="s15">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  15
                </span>
                Endemnizasyon
              </h2>
              <p>
                Ou dakò pou defann, endemnize, epi kenbe HatexCard, fondatè li, ak anplwaye
                li yo san domaj kont nenpòt reklamasyon, pèt, oswa frè (ki gen ladan avoka)
                ki soti nan: itilizasyon sèvis la pa ou, vyolasyon akò sa a, pwodwi / sèvis
                ou vann, oswa plent achtè / bank / founisè peman ki gen rapò ak ou.
              </p>
            </section>

            {/* 16 Law */}
            <section id="s16">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  16
                </span>
                Lwa ki Gouvène & Diskisyon
              </h2>
              <p className="mb-3 flex items-start gap-2">
                <Scale className="text-[#1d4ed8] shrink-0 mt-0.5" size={18} />
                <span>
                  Akò sa a gouvène pa lwa <strong>Repiblik Ayiti</strong>. Diskisyon yo ta
                  dwe eseye rezoud an premye ak sipò HatexCard; si sa pa ase, jiridiksyon
                  konpetan an Ayiti aplike.
                </span>
              </p>
              <p className="text-[13px] text-slate-600">
                Si yon klòz pa valab, rès akò a rete an vigè. Pa egzèse yon dwa pa vle di
                renonse dwa sa a.
              </p>
            </section>

            {/* 17 Definitions */}
            <section id="s17">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  17
                </span>
                Definisyon
              </h2>
              <dl className="space-y-3 text-slate-600">
                <div>
                  <dt className="font-bold text-slate-900">Pasèl / Gateway</dt>
                  <dd>Lojisyèl ki transmèt done peman ant machann ak founisè peman.</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-900">Pass-Through</dt>
                  <dd>
                    Modèl kote lajan an pa rete nan kont HatexCard — li pase dirèkteman
                    nan kont machann nan.
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-900">Machann</dt>
                  <dd>Moun oswa biznis ki gen yon kont HatexCard pou aksepte peman.</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-900">Achtè / Kliyan final</dt>
                  <dd>Moun ki peye machann nan atravè pasèl la.</dd>
                </div>
              </dl>
            </section>

            {/* 18 Contact */}
            <section id="s18">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#1d4ed8] text-sm font-bold flex items-center justify-center">
                  18
                </span>
                Kontak
              </h2>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2">
                <p className="font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="text-[#1d4ed8]" size={18} /> HatexCard
                </p>
                <p className="text-[13px]">
                  Fondatè / Direktè: <strong>Dorkensen Emetil</strong>
                </p>
                <p className="text-[13px]">
                  Sipò:{" "}
                  <a href="mailto:support@hatexcard.com" className="text-[#1d4ed8] font-bold">
                    support@hatexcard.com
                  </a>
                </p>
                <p className="text-[13px]">
                  Sit:{" "}
                  <a href="https://hatexcard.com" className="text-[#1d4ed8] font-bold">
                    hatexcard.com
                  </a>
                </p>
                <p className="text-[13px]">
                  <Link href="/support" className="text-[#1d4ed8] font-bold hover:underline">
                    Paj Sipò
                  </Link>
                  {" · "}
                  <Link href="/politik" className="text-[#1d4ed8] font-bold hover:underline">
                    Politik Konfidansyalite
                  </Link>
                </p>
              </div>
            </section>

            <div className="border-t border-slate-200 pt-8 text-[12px] text-slate-500 font-medium">
              <p className="mb-2">
                © {new Date().getFullYear()} HatexCard · Dorkensen Emetil. Tout dwa rezève.
              </p>
              <p>
                Dokiman sa a ka mete ajou. Vèsyon ki afiche sou{" "}
                <strong>hatexcard.com/terms</strong> se vèsyon ofisyèl la. Kontinye itilize
                sèvis la apre yon mizajou vle di ou aksepte nouvo kondisyon yo.
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
