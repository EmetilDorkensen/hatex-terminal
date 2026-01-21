"use client";
import React from 'react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans uppercase italic selection:bg-red-600">
      {/* NAVBAR */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="text-2xl font-black text-red-600 tracking-tighter italic">HATEXCARD</div>
        <div className="space-x-4">
          <Link href="/login" className="text-[10px] font-black hover:text-red-600 transition">KONEKTE</Link>
          <Link href="/signup" className="bg-red-600 px-6 py-2.5 rounded-full text-[10px] font-black hover:bg-red-700 transition shadow-lg shadow-red-600/20">KREYE KONT</Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-24 px-6 overflow-hidden">
        {/* Limyè background wouj */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 blur-[120px] rounded-full"></div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-[100px] font-black tracking-tighter leading-none mb-6">
            THE <span className="text-red-600">FAST</span> AND <span className="text-red-600">SECURE</span> <br /> 
            WAY TO SEND MONEY
          </h1>
          <p className="max-w-xl mx-auto text-zinc-400 text-[11px] font-bold mb-10 normal-case italic leading-relaxed">
            Join HatexCard pou w jere tranzaksyon w yo san limit. Resevwa lajan sou nenpòt biznis: 
            Shop, Bar, Makèt, ak plis ankò ak sekirite total.
          </p>
          
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-16">
             <Link href="/signup" className="bg-white text-black px-12 py-5 rounded-2xl font-black text-xs hover:scale-105 transition-all shadow-2xl shadow-white/5">
                GET STARTED
             </Link>
          </div>

          {/* DESIGN KAT LA - HATEXCARD STYLE */}
          <div className="relative inline-block mt-4 group">
            {/* Efè lonbraj wouj dèyè kat la */}
            <div className="absolute inset-0 bg-red-600 blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
            
            <div className="relative w-full max-w-[500px] aspect-[1.58/1] bg-gradient-to-br from-red-600 to-red-900 rounded-[2rem] p-8 text-left shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] border border-white/10 rotate-[-2deg] hover:rotate-0 transition-transform duration-700 overflow-hidden">
                {/* Logo ak Non */}
                <div className="flex justify-between items-start mb-12">
                   <div className="w-12 h-12 bg-black/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                      <div className="text-white font-black text-xl italic">H</div>
                   </div>
                   <div className="text-white/80 font-black text-sm tracking-widest uppercase italic">HATEXCARD</div>
                </div>

                {/* Nimewo Kat */}
                <div className="text-2xl md:text-3xl font-mono font-bold tracking-[0.2em] text-white mb-8 drop-shadow-md">
                   4550 **** **** 9121
                </div>

                {/* Detay Pwopriyetè */}
                <div className="flex justify-between items-end">
                   <div>
                      <div className="text-[8px] text-white/50 font-bold mb-1">PWOPRIYETÈ</div>
                      <div className="text-xs font-black tracking-widest uppercase italic">EMETIL DORKENSEN</div>
                   </div>
                   <div className="text-right">
                      <div className="text-[8px] text-white/50 font-bold mb-1">EXP / CVV</div>
                      <div className="text-xs font-black tracking-widest">01/30 • ***</div>
                   </div>
                </div>
                
                {/* Dekorasyon Kat */}
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* SEVIS SECTION */}
      <section className="py-20 bg-black/50 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div>
            <div className="text-red-600 text-3xl mb-4 font-black italic tracking-tighter">01. RAPID</div>
            <h3 className="font-black text-xs mb-2 italic">SEVIS RAPID ET SEKIRIZE</h3>
            <p className="text-[10px] text-zinc-500 normal-case italic">Sistèm nou an trete depo ak retrè nan mwens pase 5 minit.</p>
          </div>
          <div>
            <div className="text-red-600 text-3xl mb-4 font-black italic tracking-tighter">02. MULTIPAY</div>
            <h3 className="font-black text-xs mb-2 italic">SHOP / BAR / MAKET</h3>
            <p className="text-[10px] text-zinc-500 normal-case italic">Sèvi ak HatexCard pou peye nan tout biznis patnè nou yo san kach.</p>
          </div>
          <div>
            <div className="text-red-600 text-3xl mb-4 font-black italic tracking-tighter">03. BUSINESS</div>
            <h3 className="font-black text-xs mb-2 italic">RESEVWA LAJAN</h3>
            <p className="text-[10px] text-zinc-500 normal-case italic">Nenpòt biznis ka resevwa pèman HatexCard pou ogmante lavant yo.</p>
          </div>
        </div>
      </section>
    </div>
  );
}