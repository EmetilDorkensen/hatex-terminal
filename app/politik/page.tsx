"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export default function PolitikPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0a0b14] text-zinc-300 font-sans selection:bg-red-600/30">
      
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0b14]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <button 
            onClick={() => router.push('/')} 
            className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-white/5 hover:bg-zinc-800 transition-all text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-red-600" size={24} />
            <span className="text-white font-black italic tracking-widest uppercase">HatexCard</span>
          </div>
        </div>
      </div>

      {/* Kontni Politik la */}
      <div className="max-w-4xl mx-auto p-6 md:p-8 pb-32">
        <div className="mb-12">
          <h1 className="text-3xl md:text-5xl font-black text-white uppercase italic tracking-tighter mb-4">
            Politik Hatexcard <span className="text-red-600">— Dokiman Ofisyèl</span>
          </h1>
          <p className="text-zinc-500 font-bold tracking-widest uppercase text-sm border-l-4 border-red-600 pl-4 py-1">
            Dènye mizajou : Jen 2026
          </p>
        </div>

        <div className="space-y-8">
          
          {/* SEKSYON 1 */}
          <section>
            <h2 className="text-2xl font-black text-white mt-12 mb-6 uppercase border-b border-white/10 pb-4 flex items-center gap-2">
              <span className="text-red-600">1.</span> Kondisyon Jeneral Itilizasyon
            </h2>
            
            <h3 className="text-lg font-bold text-white mt-6 mb-3">1.1 Akseptasyon Kondisyon Yo</h3>
            <p className="mb-4 leading-relaxed">Lè ou kreye yon kont Hatexcard oswa itilize nenpòt sèvis nou ofri, ou aksepte otomatikman tout kondisyon ki ekri nan dokiman sa a. Si ou pa dakò ak youn nan kondisyon sa yo, ou pa dwe itilize sèvis Hatexcard.</p>
            <p className="mb-4 leading-relaxed">Hatexcard rezève dwa pou modifye kondisyon sa yo nenpòt ki lè. Nou ap notifye itilizatè yo pa imèl oswa pa notifikasyon sou platfòm nan. Kontinye itilize sèvis la apre yon modifikasyon vle di ou aksepte nouvo kondisyon yo.</p>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">1.2 Elijibilite</h3>
            <p className="mb-2">Pou itilize Hatexcard, ou dwe :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Gen omwen 18 an</li>
              <li>Rezide oswa fè biznis an Ayiti</li>
              <li>Bay enfòmasyon idantifikasyon ki veridik ak konplè pandan pwosesis KYC la</li>
              <li>Pa dwe sou yon lis entèdiksyon finansyè lokal oswa entènasyonal</li>
              <li>Pa gen yon istwa fwod oswa aktivite ilegal sou nenpòt platfòm finansyè</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">1.3 Kont Itilizatè</h3>
            <p className="mb-2">Ou responsab pou :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Konfidansyalite modpas ou ak tout enfòmasyon aksè kont ou</li>
              <li>Tout aktivite ki fèt sou kont ou, ke ou otorize yo oswa non</li>
              <li>Notifye Hatexcard imedyatman si ou sispèk yon aksè non otorize sou kont ou</li>
            </ul>
            <p className="text-red-400 font-bold bg-red-900/10 p-4 rounded-xl border border-red-500/20">Hatexcard p ap janm mande modpas ou pa imèl, pa telefòn, oswa pa nenpòt lòt kanal.</p>
          </section>

          {/* SEKSYON 2 */}
          <section>
            <h2 className="text-2xl font-black text-white mt-12 mb-6 uppercase border-b border-white/10 pb-4 flex items-center gap-2">
              <span className="text-red-600">2.</span> Politik Konfidansyalite (Privacy Policy)
            </h2>
            
            <h3 className="text-lg font-bold text-white mt-6 mb-3">2.1 Enfòmasyon Nou Kolekte</h3>
            <p className="mb-2">Hatexcard kolekte kategori enfòmasyon sa yo :</p>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 mb-4">
              <div>
                <span className="font-bold text-white block mb-1">Enfòmasyon Idantite :</span>
                <p className="text-sm text-zinc-400">Non konplè, dat nesans, nasyonalite. Foto idantite (CIN, paspo, lisans). Selfie pou verifikasyon byometrik.</p>
              </div>
              <div>
                <span className="font-bold text-white block mb-1">Enfòmasyon Finansyè :</span>
                <p className="text-sm text-zinc-400">Nimewo kont, istwa tranzaksyon. Sous lajan ak destinasyon tranzaksyon yo. Balans ak mouvman kont.</p>
              </div>
              <div>
                <span className="font-bold text-white block mb-1">Enfòmasyon Teknik :</span>
                <p className="text-sm text-zinc-400">Adrès IP, tip aparèy, sistèm operasyon. Lokalizasyon jeyografik (si ou pèmèt li). Dat ak lè koneksyon yo.</p>
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">2.2 Kijan Nou Itilize Enfòmasyon Ou</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Verifye idantite ou ak konfòme nou ak règleman KYC/AML</li>
              <li>Trete tranzaksyon ou yo epi pwoteje kont ou</li>
              <li>Detekte ak prevni fwod ak aktivite sispèk</li>
              <li>Amelyore sèvis nou yo epi rezoud pwoblèm teknik</li>
              <li>Voye notifikasyon enpòtan sou kont ou</li>
              <li>Konfòme nou ak obligasyon legal ak règlemantasyon</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">2.3 Pataj Enfòmasyon</h3>
            <p className="mb-2 font-bold text-white">Hatexcard pa vann enfòmasyon pèsonèl ou bay tèse pati pou rezon komèsyal.</p>
            <p className="mb-2">Nou ka pataje enfòmasyon ou sèlman nan sitiyasyon sa yo :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Lè lalwa oswa yon otorite jiridik mande li</li>
              <li>Pou konfòme nou ak règleman anti-blanchiman lajan (AML)</li>
              <li>Avèk patenal teknik nou yo ki ede nou opere platfòm nan (avèk akò konfidansyalite)</li>
              <li>Pou pwoteje dwa, propriyete, oswa sekirite Hatexcard ak itilizatè li yo</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">2.4 Konsèvasyon Done</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Tout dire kont ou aktif la</li>
              <li>5 an apre ou fèmen kont ou pou rezon legal ak règlemantè</li>
              <li>Pi lontan si lalwa mande li nan ka envestigasyon</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">2.5 Dwa Ou Genyen</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Aksede ak done pèsonèl ou nou genyen</li>
              <li>Mande koreksyon done ki pa egzak</li>
              <li>Mande efasman done ou (si lalwa pèmèt li)</li>
              <li>Opoze trete done ou nan sèten sitiyasyon</li>
              <li>Pòte plent devan otorite konpetan si ou kwè dwa ou vyole</li>
            </ul>
            <p className="mb-4">Pou egzèse dwa sa yo, kontakte nou nan : <a href="mailto:contact@hatexcard.com" className="text-red-500 font-bold hover:underline">contact@hatexcard.com</a></p>
          </section>

          {/* SEKSYON 3 */}
          <section>
            <h2 className="text-2xl font-black text-white mt-12 mb-6 uppercase border-b border-white/10 pb-4 flex items-center gap-2">
              <span className="text-red-600">3.</span> Politik Anti-Fwod & Sekirite
            </h2>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">3.1 Sistèm Deteksyon Fwod</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Siveyans tranzaksyon an tan reyèl 24h/7j</li>
              <li>Deteksyon konpòtman etranj sou kont yo</li>
              <li>Verifikasyon idantite milti-nivo (KYC)</li>
              <li>Otantifikasyon de faktè (2FA) pou tout aksè sansib</li>
              <li>Chifreman done SSL/TLS pou tout komunikasyon</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">3.2 Tranzaksyon Entèdi</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Blanchiman lajan oswa finansman aktivite kriminèl</li>
              <li>Tranzaksyon ki asosye ak dwòg, zam, oswa aktivite ilegal</li>
              <li>Fwod, eskwokri, oswa manipilasyon lòt itilizatè</li>
              <li>Finanse òganizasyon terroris oswa aktivite ki mete lavi moun an danje</li>
              <li>Evasyon fiskal oswa kachèt revni</li>
              <li>Vann oswa achte machandiz fèk, vòlè, oswa ilegal</li>
              <li>Jwe ilegal oswa sistèm ponzi</li>
              <li>Nenpòt aktivite ki vyole lwa Repiblik Ayiti</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">3.3 Konsekans Vyolasyon</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Kont ou ka sispann imedyatman san avètisman</li>
              <li>Tranzaksyon an ka bloke ak revèse</li>
              <li>Enfòmasyon ou ka transmèt bay otorite konpetan</li>
              <li>Ou ka pèdi tout dwa sou fon ki nan kont ou si fwod konfime</li>
              <li>Ou ka fè fas ak pousuit jiridik selon lwa ayisyen</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">3.4 Responsabilite Itilizatè</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Pwoteje enfòmasyon koneksyon ou — pa janm pataje yo</li>
              <li>Verifikasyon kont ou regilyèman pou detekte aktivite etranj</li>
              <li>Rapòte imedyatman tout tranzaksyon ou pa rekonèt</li>
              <li>Pa itilize aparèy piblik oswa WiFi piblik pou aksede kont ou</li>
              <li>Pa klike sou lyen sispèk ki reklame yo se Hatexcard</li>
            </ul>
          </section>

          {/* SEKSYON 4 */}
          <section>
            <h2 className="text-2xl font-black text-white mt-12 mb-6 uppercase border-b border-white/10 pb-4 flex items-center gap-2">
              <span className="text-red-600">4.</span> Politik KYC & AML
            </h2>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">4.1 Obligasyon KYC (Know Your Customer)</h3>
            <p className="mb-2">Konfòmeman ak règleman finansyè entènasyonal ak lwa ayisyen, Hatexcard oblije verifye idantite tout itilizatè anvan yo ka itilize sèvis konplè yo.</p>
            <p className="mb-2">Dokiman obligatwa :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Yon pyès idantite valid (CIN, paspo, oswa lisans)</li>
              <li>Yon selfie ak pyès idantite a</li>
              <li>Pafwa : prèv adrès (bòdwo sèvis piblik, relvè bank)</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">4.2 Nivo Verifikasyon</h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-left border-collapse rounded-2xl overflow-hidden hidden md:table border border-white/10">
                <thead>
                  <tr className="bg-zinc-900 text-[10px] uppercase font-black text-zinc-500 tracking-widest border-b border-white/10">
                    <th className="p-4">Nivo</th>
                    <th className="p-4">Limit Tranzaksyon</th>
                    <th className="p-4">Dokiman Obligatwa</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-white/5 bg-black hover:bg-zinc-900/50 transition-colors">
                    <td className="p-4 font-bold text-white">Debaz</td>
                    <td className="p-4 text-zinc-400">5,000 HTG/jou</td>
                    <td className="p-4 text-zinc-400">Imèl + telefòn</td>
                  </tr>
                  <tr className="border-b border-white/5 bg-black hover:bg-zinc-900/50 transition-colors">
                    <td className="p-4 font-bold text-white">Estanda</td>
                    <td className="p-4 text-zinc-400">50,000 HTG/jou</td>
                    <td className="p-4 text-zinc-400">CIN + selfie</td>
                  </tr>
                  <tr className="border-b border-white/5 bg-black hover:bg-zinc-900/50 transition-colors">
                    <td className="p-4 font-bold text-white">Avanse</td>
                    <td className="p-4 text-zinc-400">30,000 HTG/jou</td>
                    <td className="p-4 text-zinc-400">CIN + prèv adrès + entèvyou</td>
                  </tr>
                  <tr className="bg-black hover:bg-zinc-900/50 transition-colors">
                    <td className="p-4 font-bold text-white">Biznis</td>
                    <td className="p-4 text-zinc-400">Selon kontra</td>
                    <td className="p-4 text-zinc-400">Dokiman antrepriz konplè</td>
                  </tr>
                </tbody>
              </table>
              {/* Tablo vèsyon mobil */}
              <div className="md:hidden space-y-4">
                {[
                  { nivo: 'Debaz', limit: '5,000 HTG/jou', doc: 'Imèl + telefòn' },
                  { nivo: 'Estanda', limit: '50,000 HTG/jou', doc: 'CIN + selfie' },
                  { nivo: 'Avanse', limit: '30,000 HTG/jou', doc: 'CIN + prèv adrès + entèvyou' },
                  { nivo: 'Biznis', limit: 'Selon kontra', doc: 'Dokiman antrepriz konplè' }
                ].map((item, i) => (
                  <div key={i} className="bg-zinc-900 p-4 rounded-xl border border-white/5 space-y-2 text-sm">
                    <div className="flex justify-between font-black"><span className="text-zinc-500">NIVO:</span> <span className="text-white">{item.nivo}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">LIMIT:</span> <span className="text-zinc-300">{item.limit}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">DOKIMAN:</span> <span className="text-zinc-300 text-right">{item.doc}</span></div>
                  </div>
                ))}
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">4.3 Politik AML (Anti-Money Laundering)</h3>
            <p className="mb-2">Hatexcard aplike yon pwogram AML konplè ki gen ladan :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Siveyans kontinye tranzaksyon yo</li>
              <li>Rapòtaj tranzaksyon sispèk bay otorite konpetan</li>
              <li>Fòmasyon regilye ekip nou an sou deteksyon fwod</li>
              <li>Revizyon peryodik pwofil itilizatè ki gen gwo volim tranzaksyon</li>
              <li>Blokaj imedyat kont ki montre siy aktivite kriminèl</li>
            </ul>
          </section>

          {/* SEKSYON 5 */}
          <section>
            <h2 className="text-2xl font-black text-white mt-12 mb-6 uppercase border-b border-white/10 pb-4 flex items-center gap-2">
              <span className="text-red-600">5.</span> Politik Retrè & Depo
            </h2>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">5.1 Frè Ofisyèl</h3>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 mb-6 text-sm">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-zinc-300">Tranzaksyon P2P (ant itilizatè)</span>
                <span className="font-black text-green-500 bg-green-500/10 px-2 py-1 rounded">GRATIS</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-zinc-300">Peman bay machann ak kat</span>
                <span className="font-black text-green-500 bg-green-500/10 px-2 py-1 rounded">GRATIS</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-zinc-300">Rechaj kat</span>
                <span className="font-black text-green-500 bg-green-500/10 px-2 py-1 rounded">GRATIS</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-zinc-300">Depo</span>
                <span className="font-black text-red-500 bg-red-500/10 px-2 py-1 rounded">5%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-300">Retrè</span>
                <span className="font-black text-red-500 bg-red-500/10 px-2 py-1 rounded">5%</span>
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">5.2 Limit & Delè</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Retrè yo trete nan 24-48 è ouvrab</li>
              <li>Hatexcard rezève dwa pou mande verifikasyon adisyonèl pou gwo tranzaksyon</li>
              <li>Limit yo ka ajiste selon nivo verifikasyon itilizatè a</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">5.3 Tranzaksyon ki Pa Kapab Revèse</h3>
            <p className="mb-4 text-yellow-500 bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20">
              <span className="font-black">Atansyon :</span> Majorite tranzaksyon sou Hatexcard pa kapab revèse apre konfirmasyon. Ou responsab pou verifye tout detay anvan ou konfime yon peman.
            </p>
            <p className="mb-2">Sèl sitiyasyon kote yon tranzaksyon ka revèse :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Fwod konfime ak dokiman</li>
              <li>Erè teknik ki soti nan sistèm Hatexcard</li>
              <li>Yon òd jiridik valid</li>
            </ul>
          </section>

          {/* SEKSYON 6 */}
          <section>
            <h2 className="text-2xl font-black text-white mt-12 mb-6 uppercase border-b border-white/10 pb-4 flex items-center gap-2">
              <span className="text-red-600">6.</span> Politik Rezilyasyon & Fèmti Kont
            </h2>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">6.1 Fèmti Volontè</h3>
            <p className="mb-2">Ou ka fèmen kont ou nenpòt ki lè an kontaktant sipò nou. Anvan fèmti :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Retire tout fon ki nan kont ou</li>
              <li>Asire tout tranzaksyon an kouri yo fini</li>
              <li>Anile tout abònman aktif</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">6.2 Sispansyon oswa Fèmti Fòse</h3>
            <p className="mb-2">Hatexcard ka sispann oswa fèmen yon kont san avètisman si :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Itilizatè a vyole kondisyon itilizasyon yo</li>
              <li>Kont lan montre siy fwod oswa aktivite ilegal</li>
              <li>Itilizatè a bay fo enfòmasyon pandan KYC</li>
              <li>Yon otorite legal mande li</li>
              <li>Kont lan pa aktif pandan plis pase 12 mwa</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">6.3 Fon Apre Fèmti</h3>
            <p className="mb-2">Si kont lan fèmen ak fon ladan :</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Hatexcard ap kontakte ou pou aranje retrè fon yo</li>
              <li>Ou gen 90 jou pou reklame fon ou yo</li>
              <li>Apre 90 jou, Hatexcard ka pran dispozisyon legal pou jere fon yo selon lwa an vigè</li>
            </ul>
          </section>

          {/* SEKSYON 7 */}
          <section>
            <h2 className="text-2xl font-black text-white mt-12 mb-6 uppercase border-b border-white/10 pb-4 flex items-center gap-2">
              <span className="text-red-600">7.</span> Limit Responsabilite
            </h2>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">7.1 Sa Hatexcard Responsab Pou</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Sekirite enfòmasyon ou sou platfòm nou an</li>
              <li>Trete tranzaksyon ou yo fidèlman jan sistèm nan mande li</li>
              <li>Disponibilite sèvis la nan yon nivo rezonab</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">7.2 Sa Hatexcard Pa Responsab Pou</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-zinc-400">
              <li>Pèt ki soti nan yon aksè non otorize akòz neglijans itilizatè (pataje modpas, etc.)</li>
              <li>Tranzaksyon ou fè pa erè bay move destinatè</li>
              <li>Entèripsyon sèvis akòz faktè deyò nou kontwòl (katastwòf natirèl, pwoblèm entènèt nasyonal, etc.)</li>
              <li>Pèt komèsyal endirèk ki soti nan entèripsyon sèvis la</li>
              <li>Aksyon tèse pati ki aji mal ak enfòmasyon yo jwenn ilegalman</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">7.3 Fòs Majè</h3>
            <p className="mb-4 leading-relaxed">Hatexcard pa ka teni responsab pou nenpòt echèk oswa reta nan sèvis li si sa soti nan evènman ki deyò kontwòl rezonab nou — tankou katastwòf natirèl, tranzisyon politik, oswa pandemi.</p>
          </section>

          {/* SEKSYON 8, 9, 10 */}
          <section>
            <h2 className="text-2xl font-black text-white mt-12 mb-6 uppercase border-b border-white/10 pb-4 flex items-center gap-2">
              <span className="text-red-600">8.</span> Rezoud Diferan & Politik Cookie
            </h2>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">8.1 Sipò ak Rezolisyon</h3>
            <p className="mb-4 text-zinc-400">Si ou gen yon plent, kontakte nou. Nou angaje pou rezoud tout diferan nan 15 jou ouvrab amikalman. Si pa gen akò, tout diferan yo soumèt ak jiridisyon tribinal konpetan Repiblik Ayiti.</p>

            <h3 className="text-lg font-bold text-white mt-6 mb-3">9. Politik Cookie</h3>
            <p className="mb-4 text-zinc-400">Hatexcard itilize cookies pou kenbe sesyon koneksyon ou aktif, amelyore eksperyans platfòm nan, ak detekte aktivite fwodilè. Ou ka dezaktive yo, men sa ka afekte sèvis la.</p>
            
            <div className="bg-black border border-red-500/30 p-8 rounded-[2rem] mt-12 text-center">
              <h3 className="text-xl font-black text-white uppercase tracking-widest mb-6">10. Kontakte Nou</h3>
              <div className="space-y-3 font-mono text-sm text-zinc-300">
                <p>📧 <a href="mailto:support@hatexcard.com" className="hover:text-red-500 transition-colors">support@hatexcard.com</a></p>
                <p>🌐 <a href="https://www.hatexcard.com" target="_blank" className="hover:text-red-500 transition-colors">www.hatexcard.com</a></p>
                <p>📱 WhatsApp : <a href="https://wa.me/50937201241" target="_blank" className="text-green-500 font-bold hover:underline">+509 37201241</a></p>
              </div>
            </div>
          </section>

        </div>

        {/* Footer Text */}
        <div className="mt-16 text-center text-xs font-bold text-zinc-600 uppercase tracking-widest border-t border-white/5 pt-8">
          <p className="mb-2">Tout politik sa yo an vigè depi Jen 2026. Hatexcard rezève dwa pou mete yo ajou nenpòt ki lè ak yon avètisman 30 jou.</p>
          <p>© 2026 Hatexcard. Tout dwa rezève. Platfòm peman digital 100% an goud pou Ayiti.</p>
        </div>
      </div>
    </div>
  );
}