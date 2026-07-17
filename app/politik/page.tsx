"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowLeft, AlertTriangle, Info, Mail, Globe, MessageCircle } from 'lucide-react';

export default function PolitikPage() {
  const router = useRouter();
  const [depositFeePct, setDepositFeePct] = useState(5);
  const [withdrawFeePct, setWithdrawFeePct] = useState(5);

  useEffect(() => {
    fetch('/api/public/fees')
      .then((r) => r.json())
      .then((d) => {
        if (d?.fees?.deposit_fee_percent != null) setDepositFeePct(Number(d.fees.deposit_fee_percent));
        if (d?.fees?.withdraw_fee_percent != null) setWithdrawFeePct(Number(d.fees.withdraw_fee_percent));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-600 font-sans selection:bg-indigo-100">
      
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <button 
            onClick={() => router.push('/')} 
            className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors shadow-sm shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-indigo-50 p-1.5 rounded-lg border border-indigo-100">
              <ShieldCheck className="text-indigo-600" size={20} />
            </div>
            <span className="text-slate-900 font-bold tracking-tight uppercase text-sm">HatexCard</span>
          </div>
        </div>
      </div>

      {/* Kontni Politik la */}
      <div className="max-w-4xl mx-auto p-5 md:p-8 pb-32">
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
            Politik Hatexcard <span className="text-indigo-600 font-semibold">— Dokiman Ofisyèl</span>
          </h1>
          <p className="text-slate-500 font-semibold tracking-wider uppercase text-xs border-l-4 border-indigo-500 pl-4 py-1">
            Dènye mizajou : Jen 2026
          </p>
        </div>

        <div className="space-y-10 text-sm md:text-base text-slate-600 leading-relaxed">
          
          {/* SEKSYON 1 */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-6 border-b border-gray-200 pb-4 flex items-center gap-3">
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm">1</span> 
              Kondisyon Jeneral Itilizasyon
            </h2>
            
            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">1.1 Akseptasyon Kondisyon Yo</h3>
            <p className="mb-4">Lè ou kreye yon kont Hatexcard oswa itilize nenpòt sèvis nou ofri, ou aksepte otomatikman tout kondisyon ki ekri nan dokiman sa a. Si ou pa dakò ak youn nan kondisyon sa yo, ou pa dwe itilize sèvis Hatexcard.</p>
            <p className="mb-4">Hatexcard rezève dwa pou modifye kondisyon sa yo nenpòt ki lè. Nou ap notifye itilizatè yo pa imèl oswa pa notifikasyon sou platfòm nan. Kontinye itilize sèvis la apre yon modifikasyon vle di ou aksepte nouvo kondisyon yo.</p>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">1.2 Elijibilite</h3>
            <p className="mb-2">Pou itilize Hatexcard, ou dwe :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Gen omwen 18 an</li>
              <li>Rezide oswa fè biznis an Ayiti</li>
              <li>Bay enfòmasyon idantifikasyon ki veridik ak konplè pandan pwosesis KYC la</li>
              <li>Pa dwe sou yon lis entèdiksyon finansyè lokal oswa entènasyonal</li>
              <li>Pa gen yon istwa fwod oswa aktivite ilegal sou nenpòt platfòm finansyè</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">1.3 Kont Itilizatè</h3>
            <p className="mb-2">Ou responsab pou :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Konfidansyalite modpas ou ak tout enfòmasyon aksè kont ou</li>
              <li>Tout aktivite ki fèt sou kont ou, ke ou otorize yo oswa non</li>
              <li>Notifye Hatexcard imedyatman si ou sispèk yon aksè non otorize sou kont ou</li>
            </ul>
            <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 mt-4">
               <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
               <p className="text-amber-800 font-semibold text-sm">Hatexcard p ap janm mande modpas ou pa imèl, pa telefòn, oswa pa nenpòt lòt kanal.</p>
            </div>
          </section>

          {/* SEKSYON 2 */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mt-12 mb-6 border-b border-gray-200 pb-4 flex items-center gap-3">
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm">2</span> 
              Politik Konfidansyalite (Privacy Policy)
            </h2>
            
            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">2.1 Enfòmasyon Nou Kolekte</h3>
            <p className="mb-3">Hatexcard kolekte kategori enfòmasyon sa yo :</p>
            <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5 mb-6">
              <div>
                <span className="font-bold text-slate-800 flex items-center gap-2 mb-1">
                   <Info size={16} className="text-indigo-500" /> Enfòmasyon Idantite :
                </span>
                <p className="text-sm text-slate-500 ml-6">Non konplè, dat nesans, nasyonalite. Foto idantite (CIN, paspo, lisans). Selfie pou verifikasyon byometrik.</p>
              </div>
              <div className="h-px bg-gray-100 ml-6"></div>
              <div>
                <span className="font-bold text-slate-800 flex items-center gap-2 mb-1">
                   <Info size={16} className="text-indigo-500" /> Enfòmasyon Finansyè :
                </span>
                <p className="text-sm text-slate-500 ml-6">Nimewo kont, istwa tranzaksyon. Sous lajan ak destinasyon tranzaksyon yo. Balans ak mouvman kont.</p>
              </div>
              <div className="h-px bg-gray-100 ml-6"></div>
              <div>
                <span className="font-bold text-slate-800 flex items-center gap-2 mb-1">
                   <Info size={16} className="text-indigo-500" /> Enfòmasyon Teknik :
                </span>
                <p className="text-sm text-slate-500 ml-6">Adrès IP, tip aparèy, sistèm operasyon. Lokalizasyon jeyografik (si ou pèmèt li). Dat ak lè koneksyon yo.</p>
              </div>
            </div>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">2.2 Kijan Nou Itilize Enfòmasyon Ou</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Verifye idantite ou ak konfòme nou ak règleman KYC/AML</li>
              <li>Trete tranzaksyon ou yo epi pwoteje kont ou</li>
              <li>Detekte ak prevni fwod ak aktivite sispèk</li>
              <li>Amelyore sèvis nou yo epi rezoud pwoblèm teknik</li>
              <li>Voye notifikasyon enpòtan sou kont ou</li>
              <li>Konfòme nou ak obligasyon legal ak règlemantasyon</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">2.3 Pataj Enfòmasyon</h3>
            <p className="mb-2 font-bold text-slate-800">Hatexcard pa vann enfòmasyon pèsonèl ou bay tès pati pou rezon komèsyal.</p>
            <p className="mb-2">Nou ka pataje enfòmasyon ou sèlman nan sitiyasyon sa yo :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Lè lalwa oswa yon otorite jiridik mande li</li>
              <li>Pou konfòme nou ak règleman anti-blanchiman lajan (AML)</li>
              <li>Avèk patnè teknik nou yo ki ede nou opere platfòm nan (avèk akò konfidansyalite)</li>
              <li>Pou pwoteje dwa, pwopriyete, oswa sekirite Hatexcard ak itilizatè li yo</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">2.4 Konsèvasyon Done</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Tout dire kont ou aktif la</li>
              <li>5 an apre ou fèmen kont ou pou rezon legal ak règlemantè</li>
              <li>Pi lontan si lalwa mande li nan ka envestigasyon</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">2.5 Dwa Ou Genyen</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Aksede ak done pèsonèl ou nou genyen</li>
              <li>Mande koreksyon done ki pa egzak</li>
              <li>Mande efasman done ou (si lalwa pèmèt li)</li>
              <li>Opoze trete done ou nan sèten sitiyasyon</li>
              <li>Pòte plent devan otorite konpetan si ou kwè dwa ou vyole</li>
            </ul>
            <p className="mb-4">Pou egzèse dwa sa yo, kontakte nou nan : <a href="mailto:contact@hatexcard.com" className="text-indigo-600 font-bold hover:underline">contact@hatexcard.com</a></p>
          </section>

          {/* SEKSYON 3 */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mt-12 mb-6 border-b border-gray-200 pb-4 flex items-center gap-3">
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm">3</span> 
              Politik Anti-Fwod & Sekirite
            </h2>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">3.1 Sistèm Deteksyon Fwod</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Siveyans tranzaksyon an tan reyèl 24h/7j</li>
              <li>Deteksyon konpòtman etranj sou kont yo</li>
              <li>Verifikasyon idantite milti-nivo (KYC)</li>
              <li>Otantifikasyon de faktè (2FA) pou tout aksè sansib</li>
              <li>Chifreman done SSL/TLS pou tout kominikasyon</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">3.2 Tranzaksyon Entèdi</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-slate-600">
              <li>Blanchiman lajan oswa finansman aktivite kriminèl</li>
              <li>Tranzaksyon ki asosye ak dwòg, zam, oswa aktivite ilegal</li>
              <li>Fwod, eskwokri, oswa manipilasyon lòt itilizatè</li>
              <li>Finanse òganizasyon teworis oswa aktivite ki mete lavi moun an danje</li>
              <li>Evasyon fiskal oswa kachèt revni</li>
              <li>Vann oswa achte machandiz fo, vòlè, oswa ilegal</li>
              <li>Jwe ilegal oswa sistèm ponzi</li>
              <li>Nenpòt aktivite ki vyole lwa Repiblik Ayiti</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">3.3 Konsekans Vyolasyon</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Kont ou ka sispann imedyatman san avètisman</li>
              <li>Tranzaksyon an ka bloke ak revèse</li>
              <li>Enfòmasyon ou ka transmèt bay otorite konpetan</li>
              <li>Ou ka pèdi tout dwa sou fon ki nan kont ou si fwod konfime</li>
              <li>Ou ka fè fas ak pouswit jiridik selon lwa ayisyen</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">3.4 Responsabilite Itilizatè</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Pwoteje enfòmasyon koneksyon ou — pa janm pataje yo</li>
              <li>Verifikasyon kont ou regilyèman pou detekte aktivite etranj</li>
              <li>Rapòte imedyatman tout tranzaksyon ou pa rekonèt</li>
              <li>Pa itilize aparèy piblik oswa WiFi piblik pou aksede kont ou</li>
              <li>Pa klike sou lyen sispèk ki reklame yo se Hatexcard</li>
            </ul>
          </section>

          {/* SEKSYON 4 */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mt-12 mb-6 border-b border-gray-200 pb-4 flex items-center gap-3">
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm">4</span> 
              Politik KYC & AML
            </h2>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">4.1 Obligasyon KYC (Know Your Customer)</h3>
            <p className="mb-2">Konfòmeman ak règleman finansyè entènasyonal ak lwa ayisyen, Hatexcard oblije verifye idantite tout itilizatè anvan yo ka itilize sèvis konplè yo.</p>
            <p className="mb-2">Dokiman obligatwa :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-6">
              <li>Yon pyès idantite valid (CIN, paspo, oswa lisans)</li>
              <li>Yon selfie ak pyès idantite a</li>
              <li>Pafwa : prèv adrès (bòdwo sèvis piblik, relvè bank)</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">4.2 Nivo Verifikasyon</h3>
            <div className="overflow-x-auto mb-6 shadow-sm rounded-2xl border border-gray-200 hidden md:block">
              <table className="w-full text-left bg-white border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 tracking-wider border-b border-gray-200">
                    <th className="p-4">Nivo</th>
                    <th className="p-4">Limit Tranzaksyon</th>
                    <th className="p-4">Dokiman Obligatwa</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">Debaz</td>
                    <td className="p-4 text-slate-600">5,000 HTG/jou</td>
                    <td className="p-4 text-slate-600">Imèl + telefòn</td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">Estanda</td>
                    <td className="p-4 text-slate-600">50,000 HTG/jou</td>
                    <td className="p-4 text-slate-600">CIN + selfie</td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">Avanse</td>
                    <td className="p-4 text-slate-600">30,000 HTG/jou</td>
                    <td className="p-4 text-slate-600">CIN + prèv adrès + entèvyou</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">Biznis</td>
                    <td className="p-4 text-slate-600">Selon kontra</td>
                    <td className="p-4 text-slate-600">Dokiman antrepriz konplè</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tablo vèsyon mobil */}
            <div className="md:hidden space-y-4 mb-6">
              {[
                { nivo: 'Debaz', limit: '5,000 HTG/jou', doc: 'Imèl + telefòn' },
                { nivo: 'Estanda', limit: '50,000 HTG/jou', doc: 'CIN + selfie' },
                { nivo: 'Avanse', limit: '30,000 HTG/jou', doc: 'CIN + prèv adrès + entèvyou' },
                { nivo: 'Biznis', limit: 'Selon kontra', doc: 'Dokiman antrepriz konplè' }
              ].map((item, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3 text-sm">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                     <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Nivo</span> 
                     <span className="text-slate-800 font-bold">{item.nivo}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                     <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Limit</span> 
                     <span className="text-slate-600 font-medium">{item.limit}</span>
                  </div>
                  <div className="flex justify-between items-center">
                     <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Dokiman</span> 
                     <span className="text-slate-600 font-medium text-right max-w-[150px]">{item.doc}</span>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">4.3 Politik AML (Anti-Money Laundering)</h3>
            <p className="mb-2">Hatexcard aplike yon pwogram AML konplè ki gen ladan :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Siveyans kontinyèl tranzaksyon yo</li>
              <li>Rapòtaj tranzaksyon sispèk bay otorite konpetan</li>
              <li>Fòmasyon regilye ekip nou an sou deteksyon fwod</li>
              <li>Revizyon peryodik pwofil itilizatè ki gen gwo volim tranzaksyon</li>
              <li>Blokaj imedyat kont ki montre siy aktivite kriminèl</li>
            </ul>
          </section>

          {/* SEKSYON 5 */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mt-12 mb-6 border-b border-gray-200 pb-4 flex items-center gap-3">
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm">5</span> 
              Politik Retrè & Depo
            </h2>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">5.1 Frè Ofisyèl</h3>
            <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 mb-6 text-sm">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="font-medium text-slate-600">Tranzaksyon P2P (ant itilizatè)</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider">Gratis</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="font-medium text-slate-600">Peman bay machann ak kat</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider">Gratis</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="font-medium text-slate-600">Rechaj kat</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider">Gratis</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="font-medium text-slate-600">Depo</span>
                <span className="font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-md text-[10px] tracking-wider">{depositFeePct}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-600">Retrè</span>
                <span className="font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-md text-[10px] tracking-wider">{withdrawFeePct}%</span>
              </div>
            </div>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">5.2 Limit & Delè</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Retrè yo trete nan 24-48 è ouvrab</li>
              <li>Hatexcard rezève dwa pou mande verifikasyon adisyonèl pou gwo tranzaksyon</li>
              <li>Limit yo ka ajiste selon nivo verifikasyon itilizatè a</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">5.3 Tranzaksyon ki Pa Kapab Revèse</h3>
            <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 mt-4 mb-4">
               <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
               <p className="text-amber-800 font-medium text-sm leading-relaxed">
                 <span className="font-bold block mb-1">Atansyon :</span> Majorite tranzaksyon sou Hatexcard pa kapab revèse apre konfimasyon. Ou responsab pou verifye tout detay anvan ou konfime yon peman.
               </p>
            </div>
            <p className="mb-2">Sèl sitiyasyon kote yon tranzaksyon ka revèse :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Fwod konfime ak dokiman</li>
              <li>Erè teknik ki soti nan sistèm Hatexcard</li>
              <li>Yon òd jiridik valid</li>
            </ul>
          </section>

          {/* SEKSYON 6 */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mt-12 mb-6 border-b border-gray-200 pb-4 flex items-center gap-3">
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm">6</span> 
              Politik Rezilyasyon & Fèmti Kont
            </h2>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">6.1 Fèmti Volontè</h3>
            <p className="mb-2">Ou ka fèmen kont ou nenpòt ki lè an kontaktant sipò nou. Anvan fèmti :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Retire tout fon ki nan kont ou</li>
              <li>Asire tout tranzaksyon an kouri yo fini</li>
              <li>Anile tout abònman aktif</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">6.2 Sispansyon oswa Fèmti Fòse</h3>
            <p className="mb-2">Hatexcard ka sispann oswa fèmen yon kont san avètisman si :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Itilizatè a vyole kondisyon itilizasyon yo</li>
              <li>Kont lan montre siy fwod oswa aktivite ilegal</li>
              <li>Itilizatè a bay fo enfòmasyon pandan KYC</li>
              <li>Yon otorite legal mande li</li>
              <li>Kont lan pa aktif pandan plis pase 12 mwa</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">6.3 Fon Apre Fèmti</h3>
            <p className="mb-2">Si kont lan fèmen ak fon ladan :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Hatexcard ap kontakte ou pou aranje retrè fon yo</li>
              <li>Ou gen 90 jou pou reklame fon ou yo</li>
              <li>Apre 90 jou, Hatexcard ka pran dispozisyon legal pou jere fon yo selon lwa an vigè</li>
            </ul>
          </section>

          {/* SEKSYON 7 */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mt-12 mb-6 border-b border-gray-200 pb-4 flex items-center gap-3">
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm">7</span> 
              Limit Responsabilite
            </h2>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">7.1 Sa Hatexcard Responsab Pou</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Sekirite enfòmasyon ou sou platfòm nou an</li>
              <li>Trete tranzaksyon ou yo fidèlman jan sistèm nan mande li</li>
              <li>Disponibilite sèvis la nan yon nivo rezonab</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">7.2 Sa Hatexcard Pa Responsab Pou</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Pèt ki soti nan yon aksè non otorize akòz neglijans itilizatè (pataje modpas, etc.)</li>
              <li>Tranzaksyon ou fè pa erè bay move destinatè</li>
              <li>Entèripsyon sèvis akòz faktè deyò nou kontwòl (katastwòf natirèl, pwoblèm entènèt nasyonal, etc.)</li>
              <li>Pèt komèsyal endirèk ki soti nan entèripsyon sèvis la</li>
              <li>Aksyon tès pati ki aji mal ak enfòmasyon yo jwenn ilegalman</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">7.3 Fòs Majè</h3>
            <p className="mb-4">Hatexcard pa ka teni responsab pou nenpòt echèk oswa reta nan sèvis li si sa soti nan evènman ki deyò kontwòl rezonab nou — tankou katastwòf natirèl, tranzisyon politik, oswa pandemi.</p>
          </section>

          {/* SEKSYON 8, 9, 10 */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mt-12 mb-6 border-b border-gray-200 pb-4 flex items-center gap-3">
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm">8</span> 
              Rezoud Diferan & Politik Cookie
            </h2>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">8.1 Sipò ak Rezolisyon</h3>
            <p className="mb-4">Si ou gen yon plent, kontakte nou. Nou angaje pou rezoud tout diferan nan 15 jou ouvrab amikalman. Si pa gen akò, tout diferan yo soumèt ak jiridiksyon tribinal konpetan Repiblik Ayiti.</p>

            <h3 className="text-base font-bold text-slate-800 mt-6 mb-3">9. Politik Cookie</h3>
            <p className="mb-4">Hatexcard itilize cookies pou kenbe sesyon koneksyon ou aktif, amelyore eksperyans platfòm nan, ak detekte aktivite fwodilè. Ou ka dezaktive yo, men sa ka afekte sèvis la.</p>
            
            <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-3xl mt-12 text-center shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wider mb-6">10. Kontakte Nou</h3>
              <div className="space-y-4 text-sm font-medium text-slate-700 flex flex-col items-center justify-center">
                <a href="mailto:support@hatexcard.com" className="flex items-center gap-2 hover:text-indigo-600 transition-colors bg-white px-5 py-2.5 rounded-xl border border-indigo-100 w-full max-w-[250px] justify-center shadow-sm">
                  <Mail size={18} className="text-indigo-500" /> support@hatexcard.com
                </a>
                <a href="https://www.hatexcard.com" target="_blank" className="flex items-center gap-2 hover:text-indigo-600 transition-colors bg-white px-5 py-2.5 rounded-xl border border-indigo-100 w-full max-w-[250px] justify-center shadow-sm">
                  <Globe size={18} className="text-indigo-500" /> www.hatexcard.com
                </a>
                <a href="https://wa.me/50937201241" target="_blank" className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 transition-colors bg-white px-5 py-2.5 rounded-xl border border-emerald-100 w-full max-w-[250px] justify-center shadow-sm">
                  <MessageCircle size={18} /> +509 3720 1241
                </a>
              </div>
            </div>
          </section>

        </div>

        {/* Footer Text */}
        <div className="mt-16 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest border-t border-gray-200 pt-8">
          <p className="mb-2">Tout politik sa yo an vigè depi Jen 2026. Hatexcard rezève dwa pou mete yo ajou nenpòt ki lè ak yon avètisman 30 jou.</p>
          <p>© 2026 Hatexcard. Tout dwa rezève. Platfòm peman digital 100% an goud pou Ayiti.</p>
        </div>
      </div>
    </div>
  );
}