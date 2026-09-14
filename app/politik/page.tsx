"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ArrowLeft,
  AlertTriangle,
  Mail,
  Globe,
  MessageCircle,
  Lock,
} from 'lucide-react';

/**
 * Politik Konfidansyalite HatexCard — estriktire tankou Privacy Statement
 * Authorize.net: pòte klè, kategori done, itilizasyon, pataj limite,
 * sekirite, dwa itilizatè, responsablite machann, limit responsablite.
 */

const SECTIONS: { id: string; title: string }[] = [
  { id: 's1', title: '1. Pòte politik sa a' },
  { id: 's2', title: '2. Enfòmasyon nou kolekte' },
  { id: 's3', title: '3. Kijan nou itilize enfòmasyon yo' },
  { id: 's4', title: '4. Kijan nou pataje enfòmasyon yo' },
  { id: 's5', title: '5. Cookies ak teknoloji swiv' },
  { id: 's6', title: '6. Sekirite done yo' },
  { id: 's7', title: '7. Konsèvasyon done' },
  { id: 's8', title: '8. Dwa ou ak chwa ou' },
  { id: 's9', title: '9. Done kliyan machann yo' },
  { id: 's10', title: '10. Sèvis twazyèm pati' },
  { id: 's11', title: '11. Minè' },
  { id: 's12', title: '12. Responsablite itilizatè & limit responsablite' },
  { id: 's13', title: '13. Chanjman nan politik sa a' },
  { id: 's14', title: '14. Kontakte nou' },
];

function H2({ id, children }: Readonly<{ id: string; children: React.ReactNode }>) {
  return (
    <h2
      id={id}
      className="text-xl md:text-2xl font-bold text-slate-900 mt-12 mb-5 border-b border-gray-200 pb-3 scroll-mt-24"
    >
      {children}
    </h2>
  );
}

function H3({ children }: Readonly<{ children: React.ReactNode }>) {
  return <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">{children}</h3>;
}

export default function PolitikPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-600 font-sans selection:bg-blue-100">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-slate-600 hover:text-[#1d4ed8] hover:bg-slate-50 transition-colors shadow-sm shrink-0"
            aria-label="Retounen"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 p-1.5 rounded-lg border border-blue-100">
              <ShieldCheck className="text-[#1d4ed8]" size={20} />
            </div>
            <span className="text-slate-900 font-bold tracking-tight text-sm">
              Politik Konfidansyalite
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-5 md:p-8 pb-32">
        {/* Tit */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
            Politik Konfidansyalite{' '}
            <span className="text-[#1d4ed8] font-semibold">HatexCard</span>
          </h1>
          <p className="text-slate-500 font-semibold tracking-wider uppercase text-xs border-l-4 border-[#1d4ed8] pl-4 py-1 mb-5">
            Dènye mizajou : Septanm 2026 · An vigè imedyatman
          </p>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-slate-700 font-medium leading-relaxed">
            Lè ou kreye yon kont, itilize sit la, API a, oswa peye yon machann atravè
            HatexCard, <strong className="text-slate-900">ou aksepte politik sa a</strong>.
            Si ou pa dakò, pa itilize sèvis la. Pou Akò Sèvis konplè a (pasèl, absans
            wallet, ranbousman, frè) gade{' '}
            <a href="/terms" className="font-bold underline text-[#1d4ed8]">hatexcard.com/terms</a>.
          </div>
        </div>

        {/* Tab matyè */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 mb-12">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            Tab matyè
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-sm font-semibold text-slate-600 hover:text-[#1d4ed8] transition-colors"
              >
                {s.title}
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-2 text-sm md:text-[15px] text-slate-600 leading-relaxed">
          {/* 1 */}
          <section>
            <H2 id="s1">1. Pòte politik sa a</H2>
            <p className="mb-4">
              Politik sa a eksplike kijan <strong className="text-slate-900">HatexCard</strong>{' '}
              (« nou ») kolekte, itilize, pataje, ak pwoteje enfòmasyon pèsonèl lè ou :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>vizite <strong className="text-slate-900">hatexcard.com</strong> oswa app nou yo;</li>
              <li>ouvri yon kont machann epi pase verifikasyon KYC;</li>
              <li>itilize API, plugin, fakti, lyen pwodwi, oswa webhook nou yo;</li>
              <li>peye yon machann atravè yon paj checkout HatexCard.</li>
            </ul>
            <p className="mb-4">
              Politik sa a <strong className="text-slate-900">pa kouvri</strong> sit entènèt
              machann yo, ni sèvis twazyèm pati (tankou MonCash / Digicel) ki gen pwòp
              politik pa yo. Nou pa responsab pratik konfidansyalite sit sa yo (gade
              seksyon 9 ak 10).
            </p>
          </section>

          {/* 2 */}
          <section>
            <H2 id="s2">2. Enfòmasyon nou kolekte</H2>

            <H3>2.1 Enfòmasyon ou ban nou dirèkteman</H3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>
                <strong className="text-slate-900">Idantite (KYC) :</strong> non konplè, dat
                nesans, nasyonalite, foto pyès idantite (CIN, paspò, lisans), selfie
                verifikasyon.
              </li>
              <li>
                <strong className="text-slate-900">Kontak :</strong> imèl, nimewo telefòn,
                non biznis.
              </li>
              <li>
                <strong className="text-slate-900">Payout :</strong> nimewo MonCash /
                NatCash oswa kont bank kote ou resevwa lajan ou.
              </li>
              <li>
                <strong className="text-slate-900">Kominikasyon :</strong> mesaj ou voye bay
                sipò nou.
              </li>
            </ul>

            <H3>2.2 Enfòmasyon tranzaksyon</H3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>montan, dat, referans kòmand, estati chak peman;</li>
              <li>nimewo telefòn MonCash moun k ap peye a (pou konfime peman an);</li>
              <li>istorik fakti, pwodwi, ak payout.</li>
            </ul>

            <H3>2.3 Enfòmasyon teknik (otomatik)</H3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>adrès IP, tip aparèy ak navigatè, sistèm operasyon;</li>
              <li>dat/lè koneksyon, paj ou vizite, aktivite sou kont lan;</li>
              <li>done cookies ak sesyon (gade seksyon 5).</li>
            </ul>

            <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 mt-4">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <p className="text-amber-800 font-medium text-sm leading-relaxed">
                <strong>Sa nou PA kolekte :</strong> nou pa janm mande ni estoke PIN MonCash
                ou. Kle API sekrè yo estoke sèlman an fòm chifre (hash) — pèsonn, menm
                anplwaye nou, pa ka li yo.
              </p>
            </div>
          </section>

          {/* 3 */}
          <section>
            <H2 id="s3">3. Kijan nou itilize enfòmasyon yo</H2>
            <p className="mb-3">Nou itilize enfòmasyon ou sèlman pou :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>bay sèvis la : kreye kont, trete peman, fè payout, voye fakti;</li>
              <li>
                <strong className="text-slate-900">verifye idantite ou (KYC)</strong> epi
                respekte obligasyon anti-blanchiman lajan (AML) ak lwa Repiblik Ayiti;
              </li>
              <li>detekte ak anpeche fwod, abi, ak aktivite ilegal;</li>
              <li>sekirize kont lan (MFA, alèt koneksyon, siveyans aktivite etranj);</li>
              <li>voye notifikasyon sèvis (konfimasyon peman, alèt sekirite, resi);</li>
              <li>reponn demann sipò ou epi amelyore pwodwi a;</li>
              <li>reponn yon demann legal valab.</li>
            </ul>
            <p className="mb-4 font-semibold text-slate-800">
              Nou pa itilize done KYC ou pou piblisite, epi nou pa voye piblisite twazyèm
              pati ba ou.
            </p>
          </section>

          {/* 4 */}
          <section>
            <H2 id="s4">4. Kijan nou pataje enfòmasyon yo</H2>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-5">
              <p className="font-bold text-slate-900 mb-1">
                HatexCard pa vann, pa lwe, ni pa fè komès ak enfòmasyon pèsonèl ou.
              </p>
              <p className="text-sm">
                Nou pataje done sèlman nan ka limite sa yo, ak pwoteksyon kontraktyèl :
              </p>
            </div>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>
                <strong className="text-slate-900">Founisè peman :</strong> MonCash / Digicel
                — pou egzekite ak konfime tranzaksyon yo.
              </li>
              <li>
                <strong className="text-slate-900">Founisè teknik :</strong> ebèjman,
                deliverabilite imèl, verifikasyon idantite — anba akò konfidansyalite,
                sèlman sa ki nesesè.
              </li>
              <li>
                <strong className="text-slate-900">Machann lan :</strong> lè ou peye yon
                machann, machann lan wè detay kòmand li a (montan, referans, estati, nimewo
                telefòn peman an) — li pa janm wè dokiman KYC ou.
              </li>
              <li>
                <strong className="text-slate-900">Otorite legal :</strong> si yon lwa, yon
                lòd tribinal, oswa yon otorite konpetan egzije sa, oswa pou rapòte
                tranzaksyon sispèk (AML).
              </li>
              <li>
                <strong className="text-slate-900">Pwoteksyon dwa :</strong> pou defann dwa,
                pwopriyete, oswa sekirite HatexCard, itilizatè nou yo, oswa piblik la.
              </li>
              <li>
                <strong className="text-slate-900">Transfè biznis :</strong> nan ka fizyon,
                akizisyon, oswa vant aktif, done yo ka transfere — politik sa a ap kontinye
                aplike.
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <H2 id="s5">5. Cookies ak teknoloji swiv</H2>
            <p className="mb-3">Nou itilize cookies estrikteman nesesè pou :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>kenbe sesyon koneksyon ou aktif ak an sekirite;</li>
              <li>egzekite pwoteksyon kont vòl sesyon (yon sèl aparèy alafwa);</li>
              <li>detekte aktivite fwodilè.</li>
            </ul>
            <p className="mb-4">
              Ou ka bloke cookies nan navigatè ou, men lè sa a ou p ap ka konekte sou kont
              ou. Nou pa itilize cookies piblisite twazyèm pati.
            </p>
          </section>

          {/* 6 */}
          <section>
            <H2 id="s6">6. Sekirite done yo</H2>
            <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Lock size={18} className="text-[#1d4ed8]" />
                <span className="font-bold text-slate-900">Mezi nou aplike</span>
              </div>
              <ul className="list-disc list-inside space-y-2 ml-1 text-sm">
                <li>Chifreman TLS/SSL pou tout kominikasyon</li>
                <li>Otantifikasyon de faktè (MFA) obligatwa pou operasyon sansib</li>
                <li>Kle API ak secret webhook estoke an fòm hash (pa lizib)</li>
                <li>Kle test ak kle live separe — yo pa janm melanje</li>
                <li>Siveyans tranzaksyon ak koneksyon an tan reyèl</li>
                <li>Aksè entèn limite : sèlman pèsonèl otorize, sou baz bezwen</li>
              </ul>
            </div>
            <p className="mb-4">
              <strong className="text-slate-900">Okenn sistèm pa garanti 100%.</strong>{' '}
              Malgre mezi sa yo, nou pa ka garanti sekirite absoli done ki transmèt sou
              entènèt. Ou rekonèt ke ou voye done yo sou pwòp risk ou, epi ou gen
              responsablite pa ou (gade seksyon 12). Si nou dekouvri yon vyolasyon ki
              afekte done ou, n ap fè w konnen jan lalwa mande sa.
            </p>
          </section>

          {/* 7 */}
          <section>
            <H2 id="s7">7. Konsèvasyon done</H2>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>
                <strong className="text-slate-900">Kont aktif :</strong> pandan tout dire
                kont lan.
              </li>
              <li>
                <strong className="text-slate-900">Apre fèmti kont :</strong> omwen 5 an —
                obligasyon legal, kontab, ak AML.
              </li>
              <li>
                <strong className="text-slate-900">Done tranzaksyon :</strong> konsève
                pandan peryòd lalwa egzije pou dosye finansye.
              </li>
              <li>
                <strong className="text-slate-900">Pi lontan si nesesè :</strong> nan ka
                envestigasyon, litij, oswa demann otorite.
              </li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <H2 id="s8">8. Dwa ou ak chwa ou</H2>
            <p className="mb-3">Ou gen dwa pou :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>mande yon kopi done pèsonèl nou genyen sou ou;</li>
              <li>mande koreksyon done ki pa egzak;</li>
              <li>
                mande efasman done ou — <strong className="text-slate-900">eksepte</strong>{' '}
                done nou oblije kenbe pou rezon legal, AML, oswa kontab (seksyon 7);
              </li>
              <li>fèmen kont ou nenpòt lè;</li>
              <li>pote plent devan otorite konpetan si ou kwè dwa ou vyole.</li>
            </ul>
            <p className="mb-4">
              Pou egzèse dwa sa yo, ekri nou nan{' '}
              <a
                href="mailto:contact@hatexcard.com"
                className="text-[#1d4ed8] font-bold hover:underline"
              >contact@hatexcard.com</a>.
              Nou ka mande verifikasyon idantite anvan nou reponn — pou pwoteje ou. Nou
              reponn nan yon delè rezonab (an jeneral 30 jou).
            </p>
          </section>

          {/* 9 */}
          <section>
            <H2 id="s9">9. Done kliyan machann yo</H2>
            <p className="mb-4">
              Lè yon kliyan peye yon machann atravè HatexCard, nou trete done peman an{' '}
              <strong className="text-slate-900">nan non machann lan</strong> pou egzekite
              tranzaksyon an. Nan ka sa a :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>
                <strong className="text-slate-900">Machann lan responsab</strong> pou pwòp
                sit li, pwòp politik konfidansyalite li, ak fason li itilize done kliyan li
                yo (non, imèl, adrès livrezon, elatriye);
              </li>
              <li>
                HatexCard itilize done kliyan an sèlman pou trete ak konfime peman an,
                voye resi, epi anpeche fwod;
              </li>
              <li>
                HatexCard <strong className="text-slate-900">pa responsab</strong> pou fason
                yon machann kolekte, itilize, oswa pwoteje done sou pwòp sit pa li.
              </li>
            </ul>
          </section>

          {/* 10 */}
          <section>
            <H2 id="s10">10. Sèvis twazyèm pati</H2>
            <p className="mb-4">
              Sèvis nou an depann de founisè deyò — espesyalman{' '}
              <strong className="text-slate-900">MonCash (Digicel)</strong> pou egzekisyon
              peman. Lè ou konfime yon peman sou telefòn ou oswa sou paj MonCash, se
              politik konfidansyalite Digicel ki aplike pou etap sa a. Sit nou ka gen lyen
              vè sit deyò; nou pa responsab kontni ni pratik sit sa yo. Nou ankouraje ou li
              politik pa yo.
            </p>
          </section>

          {/* 11 */}
          <section>
            <H2 id="s11">11. Minè</H2>
            <p className="mb-4">
              Sèvis HatexCard rezève pou moun ki gen{' '}
              <strong className="text-slate-900">18 an oswa plis</strong>. Nou pa kolekte
              done timoun fè espre. Si nou dekouvri yon kont ki kreye pa yon minè, n ap
              fèmen l epi efase done yo jan lalwa pèmèt.
            </p>
          </section>

          {/* 12 */}
          <section>
            <H2 id="s12">12. Responsablite itilizatè & limit responsablite</H2>

            <H3>12.1 Responsablite pa ou</H3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>kenbe modpas, kòd MFA, ak kle API ou yo sekrè — pa janm pataje yo;</li>
              <li>bay enfòmasyon veridik ak ajou pandan KYC ak sou kont lan;</li>
              <li>pa mete kle sekrè nan kòd frontend, GitHub piblik, oswa screenshot;</li>
              <li>siyale nou imedyatman nenpòt aksè oswa tranzaksyon ou pa rekonèt;</li>
              <li>verifye detay yon peman anvan ou konfime l.</li>
            </ul>

            <H3>12.2 Limit responsablite HatexCard</H3>
            <p className="mb-3">
              Nan limit maksimòm lalwa pèmèt, HatexCard{' '}
              <strong className="text-slate-900">pa responsab</strong> pou pèt oswa domaj ki
              soti nan :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>
                neglijans itilizatè a (modpas / kle API / kòd MFA pataje oswa mal pwoteje);
              </li>
              <li>fo enfòmasyon itilizatè a te bay pandan KYC oswa sou kont lan;</li>
              <li>
                pratik done, kontni, oswa vyolasyon sekirite sou sit machann yo oswa
                sèvis twazyèm pati (MonCash/Digicel, ebèjman, entènèt);
              </li>
              <li>
                evènman fòs majè : katastwòf natirèl, pàn kouran oswa entènèt nasyonal,
                enstabilite politik, pandemi;
              </li>
              <li>pèt endirèk, pèt pwofi, oswa pèt komèsyal ki soti nan entèripsyon sèvis.</li>
            </ul>
            <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 mt-2 mb-4">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <p className="text-amber-800 font-medium text-sm leading-relaxed">
                HatexCard p ap janm mande w modpas ou, kòd MFA ou, ni PIN MonCash ou — ni
                pa imèl, ni pa telefòn, ni pa WhatsApp. Nenpòt moun ki mande sa se yon
                eskwo — pa reponn, epi siyale nou li.
              </p>
            </div>

            <H3>12.3 Vyolasyon & konsekans</H3>
            <p className="mb-4">
              Si ou itilize sèvis la pou fwod, blanchiman lajan, oswa nenpòt aktivite
              ilegal : kont lan ka sispann san avètisman, tranzaksyon yo ka bloke, epi
              enfòmasyon yo ka transmèt bay otorite konpetan, jan{' '}
              <a href="/terms" className="text-[#1d4ed8] font-bold hover:underline">Akò Sèvis la (/terms)</a>{' '}
              prevwa sa.
            </p>
          </section>

          {/* 13 */}
          <section>
            <H2 id="s13">13. Chanjman nan politik sa a</H2>
            <p className="mb-4">
              Nou ka mete politik sa a ajou nenpòt lè. Pou chanjman enpòtan, n ap fè w
              konnen pa imèl oswa pa notifikasyon sou platfòm nan omwen{' '}
              <strong className="text-slate-900">30 jou</strong> davans. Dat « dènye
              mizajou » a anlè paj la ap toujou montre vèsyon ki an vigè. Si ou kontinye
              itilize sèvis la apre chanjman yo antre an vigè, sa vle di ou aksepte yo.
            </p>
          </section>

          {/* 14 */}
          <section>
            <H2 id="s14">14. Kontakte nou</H2>
            <p className="mb-6">
              Pou nenpòt kesyon sou politik sa a oswa sou done pèsonèl ou :
            </p>
            <div className="bg-blue-50 border border-blue-100 p-8 rounded-3xl text-center shadow-sm">
              <div className="space-y-4 text-sm font-medium text-slate-700 flex flex-col items-center justify-center">
                <a
                  href="mailto:contact@hatexcard.com"
                  className="flex items-center gap-2 hover:text-[#1d4ed8] transition-colors bg-white px-5 py-2.5 rounded-xl border border-blue-100 w-full max-w-[280px] justify-center shadow-sm"
                >
                  <Mail size={18} className="text-[#1d4ed8]" /> contact@hatexcard.com
                </a>
                <a
                  href="mailto:support@hatexcard.com"
                  className="flex items-center gap-2 hover:text-[#1d4ed8] transition-colors bg-white px-5 py-2.5 rounded-xl border border-blue-100 w-full max-w-[280px] justify-center shadow-sm"
                >
                  <Mail size={18} className="text-[#1d4ed8]" /> support@hatexcard.com
                </a>
                <a
                  href="https://wa.me/50937201241"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 transition-colors bg-white px-5 py-2.5 rounded-xl border border-emerald-100 w-full max-w-[280px] justify-center shadow-sm"
                >
                  <MessageCircle size={18} /> +509 3720 1241
                </a>
                <a
                  href="https://www.hatexcard.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-[#1d4ed8] transition-colors bg-white px-5 py-2.5 rounded-xl border border-blue-100 w-full max-w-[280px] justify-center shadow-sm"
                >
                  <Globe size={18} className="text-[#1d4ed8]" /> www.hatexcard.com
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest border-t border-gray-200 pt-8">
          <p className="mb-2">
            Politik sa a an vigè depi Septanm 2026. HatexCard rezève dwa pou mete l ajou ak
            yon avètisman 30 jou pou chanjman enpòtan.
          </p>
          <p>© 2026 HatexCard. Tout dwa rezève. Pasèl peman 100% an Goud pou Ayiti.</p>
        </div>
      </div>
    </div>
  );
}
