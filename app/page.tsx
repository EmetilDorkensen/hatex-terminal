"use client";
import React from 'react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans uppercase italic selection:bg-red-600 overflow-x-hidden">
      
      {/* 1. NAVBAR PWO`}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto relative z-50">
        <div className="text-2xl font-black text-red-600 tracking-tighter italic">HATEXCARD</div>
        <div className="hidden lg:flex gap-8 text-[10px] font-black tracking-widest text-zinc-400">
            <a href="#fonksyonman" className="hover:text-white transition">KIJAN L MACHE</a>
            <a href="#biznis" className="hover:text-white transition">BIZNIS</a>
            <a href="#sekirite" className="hover:text-white transition">SEKIRITE</a>
        </div>
        <div className="space-x-4">
          <Link href="/login" className="text-[10px] font-black hover:text-red-600 transition">LOGIN</Link>
          <Link href="/signup" className="bg-red-600 px-8 py-3 rounded-full text-[10px] font-black shadow-lg shadow-red-600/20 hover:bg-red-700 transition">KÒMANSE KOUNYE A</Link>
        </div>
      </nav>

      {/* 2. HERO SECTION - DASHBOARD NAN TELEFÒN */}
      <section className="relative pt-20 pb-32 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="z-10">
          <div className="inline-block bg-red-600/10 border border-red-600/20 px-4 py-1 rounded-full text-[8px] font-black text-red-500 mb-6 tracking-[0.2em]">SISTÈM PÈMAN #1 AN AYITI</div>
          <h1 className="text-6xl md:text-[90px] font-black tracking-tighter leading-[0.85] mb-8 italic">
            IDANTITE <br /> <span className="text-red-600">FINANSYÈ</span> <br /> OU MERITE.
          </h1>
          <p className="max-w-md text-zinc-400 text-[11px] font-bold mb-10 normal-case italic leading-relaxed">
            HatexCard pa sèlman yon kat, se yon Dashboard konplè nan pòch ou. Kontwole balans ou, voye invoice, ak peye anliy ak yon sekirite nivo militè.
          </p>
          <div className="flex gap-4">
            <Link href="/signup" className="bg-white text-black px-10 py-5 rounded-2xl font-black text-xs hover:scale-105 transition-all shadow-2xl">OUVRI YON KONT GRATIS</Link>
          </div>
        </div>

        {/* MOKUP TELEFÒN AK DASHBOARD PWO */}
        <div className="relative flex justify-center">
            <div className="absolute inset-0 bg-red-600 blur-[150px] opacity-10"></div>
            {/* Frame Telefòn nan */}
            <div className="relative w-[300px] h-[600px] bg-zinc-900 rounded-[3rem] border-[8px] border-zinc-800 shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden">
                {/* Sa ki andedan telefòn nan (Dashboard la) */}
                <div className="p-6 space-y-6">
                    <div className="flex justify-between items-center mt-4">
                        <div className="w-8 h-8 bg-red-600 rounded-full"></div>
                        <div className="text-[10px] font-black italic">DASHBOARD</div>
                    </div>
                    {/* Kat Vityèl la nan telefòn nan */}
                    <div className="w-full h-40 bg-gradient-to-br from-red-600 to-red-900 rounded-2xl p-4 shadow-xl relative overflow-hidden">
                        <div className="text-[8px] opacity-50 mb-6 uppercase tracking-widest">Balans Disponib</div>
                        <div className="text-2xl font-black italic mb-4">162,441 <span className="text-[10px]">GOUD</span></div>
                        <div className="text-[10px] font-mono tracking-widest">**** **** 9121</div>
                        <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full blur-xl"></div>
                    </div>
                    {/* Bouton rapid yo */}
                    <div className="grid grid-cols-3 gap-2">
                        {['DEPO', 'RETRÈ', 'TRANSFER'].map(b => (
                            <div key={b} className="bg-zinc-800 p-3 rounded-xl text-[7px] font-black text-center border border-white/5">{b}</div>
                        ))}
                    </div>
                    {/* Tranzaksyon resan */}
                    <div className="space-y-3">
                        <div className="text-[8px] font-black text-zinc-500">DENYE TRANZAKSYON</div>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5">
                                <div className="flex gap-2 items-center">
                                    <div className="w-6 h-6 bg-green-500/20 rounded flex items-center justify-center text-[10px]">↓</div>
                                    <div className="text-[8px] font-bold">Depo Konfime</div>
                                </div>
                                <div className="text-[8px] font-black text-green-500">+5000 HTG</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* 3. KIJAN POU RECHADE AK FE RETRE (TRANSPARANS) */}
      <section id="fonksyonman" className="py-24 bg-zinc-900/20 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black italic tracking-tighter mb-4">RECHADE AK RETIRE <span className="text-red-600">SAN TÈT CHAKE</span></h2>
            <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest italic">Sistèm nan fonksyone ak tout metòd lokal yo</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Metòd Rechaj */}
            <div className="bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5 hover:border-red-600/30 transition group">
              <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mb-8 text-2xl group-hover:scale-110 transition">📥</div>
              <h3 className="text-xl font-black italic mb-6">KIJAN POU RECHADE?</h3>
              <ul className="space-y-4 text-[11px] font-bold text-zinc-400 italic normal-case">
                <li className="flex gap-3"> <span className="text-red-600">●</span>  (MonCash, NatCash oswa Bank) .</li>
                <li className="flex gap-3"> <span className="text-red-600">●</span> Admin yo ap verifye epi kredite balans ou nan mwens pase 5 minit.</li>
                <li className="flex gap-3"> <span className="text-red-600">●</span> Resevwa notifikasyon pa imèl .</li>
              </ul>
            </div>

            {/* Metòd Retrè */}
            <div className="bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5 hover:border-red-600/30 transition group">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-8 text-2xl group-hover:scale-110 transition grayscale group-hover:grayscale-0">📤</div>
              <h3 className="text-xl font-black italic mb-6">KIJAN POU FE RETRE?</h3>
              <ul className="space-y-4 text-[11px] font-bold text-zinc-400 italic normal-case">
                <li className="flex gap-3"> <span className="text-red-600">●</span> Klike sou bouton "Retrè" a, mete montan an epi chwazi ki kote w vle resevwa lajan an.</li>
                <li className="flex gap-3"> <span className="text-red-600">●</span> Transfè a ap fèt dirèkteman sou nimewo MonCash/Natcash oswa kont bankè ou.</li>
                <li className="flex gap-3"> <span className="text-red-600">●</span> .</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

     {/* 4. BUSINESS, INVOICE & TERMINAL API SECTION */}
<section id="biznis" className="py-24 max-w-7xl mx-auto px-6">
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
    
    {/* BÒ GÒCH: TERMINAL VITYÈL AK API MOCKUP */}
    <div className="relative group">
      <div className="absolute inset-0 bg-red-600 blur-[100px] opacity-10 rounded-full group-hover:opacity-20 transition"></div>
      
      {/* TERMINAL PÈMAN MODÈN */}
      <div className="relative bg-[#0d0e1a] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl transform group-hover:scale-[1.02] transition-transform duration-500">
        {/* Header Terminal la */}
        <div className="bg-zinc-900/80 p-4 border-b border-white/5 flex justify-between items-center px-8">
          <div className="flex gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-600"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-600"></div>
          </div>
          <div className="text-[9px] font-black text-zinc-500 tracking-[0.2em]">HATEX TERMINAL V2</div>
        </div>

        {/* Kontni Terminal la */}
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-xs font-black italic">ESTATI PÈMAN</h4>
            <span className="bg-green-500/10 text-green-500 text-[8px] px-3 py-1 rounded-full font-black animate-pulse uppercase">An tèminal...</span>
          </div>

          {/* Vizyèl Kat k ap glise nan tèminal la */}
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 flex items-center gap-6">
            <div className="w-16 h-10 bg-gradient-to-br from-red-600 to-red-900 rounded-md shadow-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-yellow-500/20 rounded-sm"></div>
            </div>
            <div>
              <p className="text-[10px] font-black italic">IDANTITE FINANSYÈ</p>
              <p className="text-[8px] text-zinc-500 font-bold uppercase">**** **** **** 9121</p>
            </div>
          </div>

          {/* API Code Snippet pou montre li ka entegre sou sit */}
          <div className="bg-black/50 p-4 rounded-xl font-mono text-[9px] text-zinc-400 border-l-2 border-red-600">
            <p className="text-red-500 font-bold italic mb-1">// Entegre sou sit entènèt ou</p>
            <p><span className="text-zinc-500">hatex.</span><span className="text-white">createPayment</span>({'{'}</p>
            <p className="pl-4">amount: <span className="text-green-500">"AUTO"</span>,</p>
            <p className="pl-4">currency: <span className="text-green-500">"HTG"</span>,</p>
            <p className="pl-4">terminalId: <span className="text-green-500">"HX-99"</span></p>
            <p>{'}'});</p>
          </div>
        </div>
      </div>

      {/* Floating Invoice Badge */}
      <div className="absolute -top-6 -right-6 w-28 h-28 bg-red-600 rounded-full border-[6px] border-[#0a0b14] flex items-center justify-center shadow-xl rotate-12 group-hover:rotate-0 transition-transform duration-500">
        <div className="text-center">
          <div className="text-[8px] font-black italic">SEND</div>
          <div className="text-[11px] font-black uppercase tracking-tighter leading-none">INVOICE</div>
        </div>
      </div>
    </div>

    {/* BÒ DWAT: TÈKS AK DETAY BIZNIS */}
    <div className="space-y-8">
      <div>
        <h2 className="text-5xl font-black italic mb-6 tracking-tighter leading-none">
          POU <span className="text-red-600">BIZNIS</span> <br />& DEVELOPERS.
        </h2>
        <p className="text-zinc-400 text-[12px] font-bold italic mb-8 normal-case leading-relaxed">
          HatexCard ofri pi plis pase yon kat. Nou bay biznis yo yon **Terminal API** konplè pou yo ka resevwa pèman dirèkteman sou sit entènèt yo, nan shop yo, oswa voye Invoice bay kliyan.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5 hover:border-red-600/20 transition">
          <div className="text-red-600 font-black mb-2 italic uppercase text-[10px]">TERMINAL API</div>
          <p className="text-[10px] text-zinc-500 font-bold normal-case italic">Entegre bouton pèman Hatex la sou nenpòt sit entènèt nan kèk minit.</p>
        </div>
        <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5 hover:border-red-600/20 transition">
          <div className="text-red-600 font-black mb-2 italic uppercase text-[10px]">RESEVWA GOUD</div>
          <p className="text-[10px] text-zinc-500 font-bold normal-case italic">Solisyon ideyal pou tout biznis ki resevwa Goud kòm pèman prensipal.</p>
        </div>
      </div>

      <div className="pt-4">
        <button className="bg-white text-black px-8 py-4 rounded-2xl font-black text-[10px] uppercase italic hover:bg-red-600 hover:text-white transition-all shadow-xl">
           Mande aksè API kounye a
        </button>
      </div>
    </div>

  </div>
</section>

      {/* 5. FOOTER STYLE KREZYPAY */}
      <footer className="bg-black py-20 border-t border-white/5 mt-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-16">
          <div className="space-y-6">
            <div className="text-2xl font-black text-red-600 italic">HATEXCARD</div>
            <p className="text-[11px] text-zinc-500 font-bold italic normal-case leading-relaxed">
              Pi gwo platfòm pèman an Ayiti. Sekirite w se priyorite nou. Trete tout tranzaksyon w yo nan yon klike.
            </p>
          </div>
          <div>
            <h4 className="font-black text-sm italic mb-8 tracking-[0.2em]">QUICK LINKS</h4>
            <ul className="text-[11px] font-bold text-zinc-500 space-y-4 italic">
              <li className="hover:text-red-600 cursor-pointer transition">› KIJAN POU ITILIZE</li>
              <li className="hover:text-red-600 cursor-pointer transition">› FAQ & SIPÒ</li>
              <li className="hover:text-red-600 cursor-pointer transition">› SOLISYON BIZNIS</li>
              <li className="hover:text-red-600 cursor-pointer transition">› SEKIRITE DONE</li>
            </ul>
          </div>
          <div>
            <h4 className="font-black text-sm italic mb-8 tracking-[0.2em]">KONTAK</h4>
            <div className="space-y-4">
                <div className="flex items-center gap-4 bg-zinc-900 p-4 rounded-2xl border border-white/5">
                    <div className="text-xl"></div>
                    <div>
                        <div className="text-[8px] text-zinc-500 font-black tracking-widest uppercase">Telefòn</div>
                        <div className="text-[11px] font-black italic">+509 0000 0000</div>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-zinc-900 p-4 rounded-2xl border border-white/5">
                    <div className="text-xl">✉️</div>
                    <div>
                        <div className="text-[8px] text-zinc-500 font-black tracking-widest uppercase">Imèl Sipò</div>
                        <div className="text-[11px] font-black italic">support@hatexcard.com</div>
                    </div>
                </div>
            </div>
          </div>
        </div>
        <div className="mt-20 pt-8 border-t border-white/5 text-center">
            <p className="text-[9px] font-black text-zinc-700 tracking-[0.5em]">© 2026 HATEXCARD - TOUT DWA REZÈVE</p>
        </div>
      </footer>
    </div>
  );
}