"use client";
import React from 'react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans uppercase italic selection:bg-red-600 overflow-x-hidden">
      
      {/* NAVBAR */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto relative z-50">
        <div className="text-2xl font-black text-red-600 tracking-tighter italic underline decoration-white/10">HATEXCARD</div>
        <div className="space-x-6">
          <Link href="/login" className="text-[10px] font-black hover:text-red-600 transition tracking-widest">LOGIN</Link>
          <Link href="/signup" className="bg-red-600 px-8 py-3 rounded-full text-[10px] font-black hover:bg-red-700 transition shadow-lg shadow-red-600/30">REGISTER</Link>
        </div>
      </nav>

      {/* HERO SECTION - KAT LA AN AKSYON */}
      <section className="relative pt-12 pb-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <div className="text-left z-10">
            <h1 className="text-5xl md:text-[80px] font-black tracking-tighter leading-[0.9] mb-8 italic">
              PEYE <span className="text-red-600">NÈNPÒT KOTE</span> <br /> KI RESEVWA GOUD
            </h1>
            <p className="max-w-md text-zinc-400 text-[11px] font-bold mb-10 normal-case italic leading-relaxed border-l-2 border-red-600 pl-4">
              Peye sèvis ou, achte anliy oswa nan magazen lokal. HatexCard se solisyon final pou tranzaksyon an goud san pwoblèm nan menm segonn lan.
            </p>
            <Link href="/signup" className="inline-block bg-white text-black px-12 py-5 rounded-2xl font-black text-xs hover:scale-105 transition-all shadow-2xl">
                KÒMANSE KOUNYE A
            </Link>
          </div>

          {/* Imaj Moun kap kenbe kat la (Dwa bò kote tèks la) */}
          <div className="relative group">
            <div className="absolute inset-0 bg-red-600 blur-[150px] opacity-10 rounded-full"></div>
            {/* Si ou gen pwòp imaj ou, ranplase URL sa a */}
            <img 
              src="https://images.unsplash.com/photo-1556742044-3c52d6e88c62?q=80&w=1000&auto=format&fit=crop" 
              alt="Moun ap peye nan shop" 
              className="relative w-full h-[400px] object-cover rounded-[3rem] shadow-2xl border border-white/5 grayscale-[50%] group-hover:grayscale-0 transition duration-700"
            />
            {/* Ti Kat la ki flote sou imaj la */}
            <div className="absolute -bottom-10 -left-10 w-64 h-40 bg-gradient-to-br from-red-600 to-red-900 rounded-2xl p-4 shadow-2xl border border-white/20 rotate-[-10deg] animate-bounce-slow">
               <div className="text-[8px] font-black mb-4">HATEXCARD</div>
               <div className="text-sm font-mono tracking-widest mb-4">**** **** **** 9121</div>
               <div className="text-[10px] font-black italic">JOHN DOE</div>
            </div>
          </div>
        </div>
      </section>

      {/* BUSINESS & INVOICE SECTION */}
      <section className="py-24 bg-zinc-900/30 border-y border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
          
          <div className="order-2 md:order-1 relative">
             <div className="w-full aspect-square bg-zinc-900 rounded-full flex items-center justify-center p-8 border border-white/5">
                <div className="relative">
                   {/* Imaj kote yap pran kat la nan men moun nan */}
                   <img 
                    src="https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?q=80&w=600&auto=format&fit=crop" 
                    alt="Transaksyon biwo" 
                    className="w-full h-full object-cover rounded-full"
                   />
                   {/* Circle Invoice la */}
                   <div className="absolute top-0 right-0 w-24 h-24 bg-red-600 rounded-full flex flex-col items-center justify-center border-4 border-[#0a0b14] shadow-xl">
                      <div className="text-[8px] font-black italic">Voye</div>
                      <div className="text-[10px] font-black uppercase italic tracking-tighter">INVOICE</div>
                   </div>
                </div>
             </div>
          </div>

          <div className="order-1 md:order-2">
            <h2 className="text-4xl font-black italic mb-6 tracking-tighter">SOLISYON POU <br /><span className="text-red-600">MOUN KI GEN BIZNIS</span></h2>
            <div className="space-y-6">
               <div className="flex gap-4">
                  <div className="bg-red-600/10 p-3 rounded-xl text-red-600 font-black">✓</div>
                  <p className="text-[11px] font-bold text-zinc-400 italic normal-case">Voye fakti (invoice) bay kliyan ou yo dirèkteman epi resevwa lajan an goud nan yon klike.</p>
               </div>
               <div className="flex gap-4">
                  <div className="bg-red-600/10 p-3 rounded-xl text-red-600 font-black">✓</div>
                  <p className="text-[11px] font-bold text-zinc-400 italic normal-case">Jere tout lavant ou nan yon sèl tablodbò san danje.</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER - STYLE KREZYPAY OU TE MANDE A */}
      <footer className="bg-black py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-16">
          
          {/* Logo & Slogan */}
          <div className="space-y-6">
            <div className="text-2xl font-black text-red-600 italic">HATEXCARD</div>
            <p className="text-[11px] text-zinc-500 font-bold italic normal-case leading-relaxed">
              Fè tranzaksyon an sekirite nenpòt ki lè nan jounen an. Nou gen pi bon to mache a ak frè ki pi ba yo.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-black text-sm italic mb-6">QUICK LINKS</h4>
            <ul className="text-[11px] font-bold text-zinc-400 space-y-3 italic">
              <li className="hover:text-red-600 cursor-pointer transition flex items-center gap-2"><span>&gt;</span> Pèman Entegrasyon</li>
              <li className="hover:text-red-600 cursor-pointer transition flex items-center gap-2"><span>&gt;</span> Kijan pou itilize</li>
              <li className="hover:text-red-600 cursor-pointer transition flex items-center gap-2"><span>&gt;</span> FAQ & Sipò</li>
              <li className="hover:text-red-600 cursor-pointer transition flex items-center gap-2"><span>&gt;</span> Solisyon Biznis</li>
            </ul>
          </div>

          {/* Kontak Info */}
          <div className="space-y-4">
             <h4 className="font-black text-sm italic mb-6">KONTAKTE NOU</h4>
             <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-white/5 hover:border-red-600/30 transition">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center font-black">📞</div>
                <div>
                   <p className="text-[8px] text-zinc-500 font-black">TELEFÒN</p>
                   <p className="text-[10px] font-black italic">+509 0000 0000</p>
                </div>
             </div>
             <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-white/5 hover:border-red-600/30 transition mt-4">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center font-black">✉️</div>
                <div>
                   <p className="text-[8px] text-zinc-500 font-black">IMÈL NOU</p>
                   <p className="text-[10px] font-black italic">support@hatexcard.com</p>
                </div>
             </div>
          </div>
        </div>
        <div className="mt-20 text-center border-t border-white/5 pt-8">
           <p className="text-[9px] font-black text-zinc-600 tracking-[0.3em]">© 2026 HATEXCARD - PWOPRIYETE HATEX GROUP</p>
        </div>
      </footer>
    </div>
  );
}