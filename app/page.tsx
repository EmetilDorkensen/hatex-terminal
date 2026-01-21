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

      {/* 4. BUSINESS & INVOICE SECTION */}
      <section id="biznis" className="py-24 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="relative">
                <img 
                    src="Screenshot 2026-01-21 113440.png" 
                    className="rounded-[3rem] border border-white/10 grayscale hover:grayscale-0 transition duration-700" 
                    alt="Business Hatex" 
                />
                {/* Floating Invoice Circle */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-600 rounded-full border-[8px] border-[#0a0b14] flex items-center justify-center animate-pulse">
                    <div className="text-center">
                        <div className="text-[10px] font-black italic">VOYE</div>
                        <div className="text-xs font-black">INVOICE</div>
                    </div>
                </div>
            </div>
            <div>
                <h2 className="text-5xl font-black italic mb-8 tracking-tighter leading-none">SOLISYON POU <br /> <span className="text-red-600">BIZNISMAN AK SHOP</span>.</h2>
                <p className="text-zinc-400 text-[12px] font-bold italic mb-8 normal-case leading-relaxed">
                    Si ou se yon machann oswa ou gen yon magazen, HatexCard pèmèt ou voye fakti bay kliyan ou yo pou yo ka peye w rapidman. Peye nenpòt kote ki resevwa goud epi ogmante lavant ou kounye a.
                </p>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-900 p-6 rounded-2xl border border-white/5">
                        <div className="text-red-600 font-black mb-2 italic">99.9%</div>
                        <div className="text-[9px] font-bold text-zinc-500 uppercase">Sekirite Garanti</div>
                    </div>
                    <div className="bg-zinc-900 p-6 rounded-2xl border border-white/5">
                        <div className="text-red-600 font-black mb-2 italic">0 FRÈ</div>
                        <div className="text-[9px] font-bold text-zinc-500 uppercase">Pou kreyasyon kont</div>
                    </div>
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