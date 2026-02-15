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
{/* SECTION HERO AK DASHBOARD RE-KREYE AK KÒD */}
<section className="relative pt-20 pb-32 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
  <div className="z-10 text-left">
    <div className="inline-block bg-red-600/10 border border-red-600/20 px-4 py-1 rounded-full text-[8px] font-black text-red-500 mb-6 tracking-[0.2em]">APLIKASYON HATEXCARD V2</div>
    <h1 className="text-6xl md:text-[90px] font-black tracking-tighter leading-[0.85] mb-8 italic text-white uppercase">
      IDANTITE <br /> <span className="text-red-600">FINANSYÈ</span> <br /> OU MERITE.
    </h1>
    <p className="max-w-md text-zinc-400 text-[11px] font-bold mb-10 normal-case italic leading-relaxed border-l-2 border-red-600 pl-4">
      Jere tout tranzaksyon ou yo dirèkteman nan Dashboard ou. Peye, resevwa, ak kontwole lajan ou an goud ak yon sekirite total kote ou ye a.
    </p>
    <div className="flex gap-4">
      <Link href="/signup" className="bg-white text-black px-10 py-5 rounded-2xl font-black text-xs hover:scale-105 transition-all shadow-2xl uppercase">OUVRI YON KONT GRATIS</Link>
    </div>
  </div>

  {/* MOKUP TELEFÒN NAN - DASHBOARD RE-KREYE AK KÒD */}
  <div className="relative flex justify-center">
      <div className="absolute inset-0 bg-red-600 blur-[150px] opacity-20"></div>
      
      {/* FRAME TELEFÒN NAN */}
      <div className="relative w-[320px] h-[650px] bg-zinc-900 rounded-[3.5rem] border-[10px] border-zinc-800 shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden">
          
          {/* KONTNI DASHBOARD (RE-KREYE AK CSS) */}
          <div className="relative w-full h-full bg-[#0a0b14] p-5 flex flex-col pt-10">
              
              {/* Notch telefòn nan */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-zinc-800 rounded-b-3xl z-30"></div>
              
              {/* HEADER DASHBOARD */}
              <div className="flex justify-between items-center mb-8">
                  <div className="text-red-600 font-black italic text-sm">HatexCard</div>
                  <div className="w-8 h-8 bg-zinc-900 rounded-full border border-white/10 flex items-center justify-center text-[10px]">🔔</div>
              </div>

              {/* BALANS SECTION */}
              <div className="mb-8">
                  <p className="text-[10px] text-zinc-500 font-black italic uppercase mb-1">Balans Disponib</p>
                  <h2 className="text-3xl font-black italic text-white">150,000.00 <span className="text-xs text-red-600">HTG</span></h2>
              </div>

              {/* KAT HATEX LA (SAN NON) */}
              <div className="w-full aspect-[1.58/1] bg-gradient-to-br from-red-600 to-red-900 rounded-2xl p-5 shadow-2xl relative overflow-hidden mb-8">
                  <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                  
                  <div className="flex justify-between items-start mb-10">
                      <div className="text-[8px] font-black italic tracking-widest text-white/80">PREMIUM CARD</div>
                      <div className="w-8 h-6 bg-white/20 rounded-sm"></div>
                  </div>
                  
                  {/* Nimewo Kat */}
                  <div className="text-lg font-mono tracking-[0.2em] text-white mb-6">
                      **** **** **** 9121
                  </div>
                  
                  <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[6px] text-white/40 font-black uppercase">Exp Date</div>
                        <div className="text-[9px] font-black text-white italic">01/30</div>
                      </div>
                      <div className="w-10 h-6 bg-orange-400/20 rounded-md border border-orange-400/30"></div>
                  </div>
              </div>

              {/* QUICK ACTIONS */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                  {['Depo', 'Retrè', 'Voye'].map((item) => (
                      <div key={item} className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 bg-zinc-900 rounded-2xl border border-white/5 flex items-center justify-center text-lg shadow-lg">
                              {item === 'Depo' ? '↓' : item === 'Retrè' ? '↑' : '→'}
                          </div>
                          <span className="text-[9px] font-black italic uppercase text-zinc-400">{item}</span>
                      </div>
                  ))}
              </div>

              {/* TRANZAKSYON RESAN */}
              <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black italic text-zinc-500 uppercase">Tranzaksyon Resan</span>
                      <span className="text-[8px] text-red-600 font-black italic">WÈ TOUT</span>
                  </div>
                  
                  <div className="space-y-3">
                      {[
                        { label: 'Shop Market', type: 'PAYMENT', price: '-1,500.00', color: 'text-white' },
                        { label: 'Depo MonCash', type: 'DEPOSIT', price: '+5,000.00', color: 'text-green-500' },
                        { label: 'Retrè Bank', type: 'WITHDRAW', price: '-2,000.00', color: 'text-zinc-500' }
                      ].map((tx, i) => (
                          <div key={i} className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-xl border border-white/5">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-[10px]">🛒</div>
                                  <div>
                                      <p className="text-[9px] font-black italic text-white">{tx.label}</p>
                                      <p className="text-[7px] font-bold text-zinc-500 uppercase">{tx.type}</p>
                                  </div>
                              </div>
                              <div className={`text-[9px] font-black italic ${tx.color}`}>{tx.price}</div>
                          </div>
                      ))}
                  </div>
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
                <li className="flex gap-3"> <span className="text-red-600">●</span> Retire otomatikman sou balans Hatex ou a.</li>
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
      <footer className="bg-[#05050a] border-t border-white/5 pt-20 pb-10">
  <div className="max-w-7xl mx-auto px-6">
    {/* GRID SEKSYON YO */}
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-20">
      
      {/* KOLÒN 1: KONPAYI */}
      <div className="space-y-4">
        <h4 className="text-white font-black text-[10px] tracking-[0.2em] mb-6">KONPAYI</h4>
        <ul className="text-zinc-500 text-[10px] font-bold space-y-3 italic">
          <li><Link href="/about" className="hover:text-red-600 transition">SOU NOU</Link></li>
          <li><Link href="/karie" className="hover:text-red-600 transition">KARYÈ</Link></li>
          <li><Link href="/blog" className="hover:text-red-600 transition">BLOG HATEX</Link></li>
        </ul>
      </div>

      {/* KOLÒN 2: PWODWI */}
      <div className="space-y-4">
        <h4 className="text-white font-black text-[10px] tracking-[0.2em] mb-6">PWODWI</h4>
        <ul className="text-zinc-500 text-[10px] font-bold space-y-3 italic">
          <li><Link href="/terminal" className="hover:text-red-600 transition">TERMINAL API</Link></li>
          <li><Link href="/invoice" className="hover:text-red-600 transition">VIRTUAL INVOICE</Link></li>
          <li><Link href="/cards" className="hover:text-red-600 transition">KAT VITYÈL</Link></li>
        </ul>
      </div>

      {/* KOLÒN 3: RESOUS */}
      <div className="space-y-4">
        <h4 className="text-white font-black text-[10px] tracking-[0.2em] mb-6">RESOUS</h4>
        <ul className="text-zinc-500 text-[10px] font-bold space-y-3 italic">
          <li><Link href="/docs" className="hover:text-red-600 transition">DOKIMANTASYON</Link></li>
          <li><Link href="/help" className="hover:text-red-600 transition">SANT ÈD</Link></li>
          <li><Link href="/status" className="hover:text-red-600 transition">STATUS SISTÈM</Link></li>
        </ul>
      </div>

      {/* KOLÒN 4: LEGAL */}
      <div className="space-y-4">
        <h4 className="text-white font-black text-[10px] tracking-[0.2em] mb-6">LEGAL</h4>
        <ul className="text-zinc-500 text-[10px] font-bold space-y-3 italic">
          <li><Link href="/privacy" className="hover:text-red-600 transition">KONFIDANSYALITE</Link></li>
          <li><Link href="/terms" className="hover:text-red-600 transition">KONDISYON ITILIZASYON</Link></li>
          <li><Link href="/cookies" className="hover:text-red-600 transition">COOKIES</Link></li>
        </ul>
      </div>

      {/* KOLÒN 5: SOSYAL (Pou Desktop) */}
      <div className="hidden lg:block space-y-6">
        <div className="text-red-600 font-black italic text-xl tracking-tighter">HATEXCARD</div>
        <p className="text-[9px] text-zinc-600 font-bold leading-relaxed">
          Solisyon pèman ki pi rapid nan Karayib la.
        </p>
        <div className="flex gap-4">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg border border-white/5 flex items-center justify-center text-xs hover:border-red-600 transition cursor-pointer">f</div>
            <div className="w-8 h-8 bg-zinc-900 rounded-lg border border-white/5 flex items-center justify-center text-xs hover:border-red-600 transition cursor-pointer">𝕏</div>
            <div className="w-8 h-8 bg-zinc-900 rounded-lg border border-white/5 flex items-center justify-center text-xs hover:border-red-600 transition cursor-pointer">in</div>
        </div>
      </div>

    </div>

    {/* LINE ANBA NÈT LA */}
    <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
      <p className="text-[9px] font-black text-zinc-600 tracking-[0.3em]">
        © 2026 HATEXCARD - YON PWODWI HATEX GROUP.
      </p>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[8px] font-black text-zinc-500">SISTÈM OPERASYONÈL</span>
        </div>
        <select className="bg-transparent text-[8px] font-black text-zinc-500 border-none outline-none cursor-pointer hover:text-white">
            <option>KREYÒL</option>
            <option>ENGLISH</option>
            <option>FRANÇAIS</option>
        </select>
      </div>
    </div>
  </div>
</footer>
    </div>
  );
}