import React from 'react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans uppercase italic">
      {/* Navbar */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="text-2xl font-black text-red-600 tracking-tighter">HATEXCARD</div>
        <div className="space-x-4">
          <Link href="/login" className="text-xs font-bold hover:text-red-600 transition">Konekte</Link>
          <Link href="/signup" className="bg-red-600 px-6 py-2 rounded-full text-xs font-black hover:bg-red-700 transition shadow-lg shadow-red-600/20">Kreye Kont</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-none mb-6">
            SÈVIS <span className="text-red-600">RAPID</span> <br /> ET SEKIRIZE
          </h1>
          <p className="max-w-2xl mx-auto text-zinc-400 text-sm md:text-base font-bold mb-10 normal-case italic">
            Join HatexCard pou w jere tranzaksyon w yo san limit. Resevwa lajan sou nenpòt biznis: 
            Shop, Bar, Makèt, ak plis ankò nan yon sèl klike.
          </p>
          
          <div className="flex flex-col md:flex-row gap-4 justify-center mb-20">
             <Link href="/signup" className="bg-white text-black px-10 py-5 rounded-2xl font-black text-sm hover:scale-105 transition shadow-2xl">GET STARTED</Link>
             <Link href="/about" className="bg-zinc-900 border border-white/10 px-10 py-5 rounded-2xl font-black text-sm hover:bg-zinc-800 transition">WÈ PLIS</Link>
          </div>

          {/* Ti Foto Kat Ou a */}
          <div className="relative inline-block group">
            <div className="absolute inset-0 bg-red-600 blur-[100px] opacity-20 group-hover:opacity-40 transition"></div>
            <img 
              src="/ti_foto_kat_ou_a.png" // Mete non fichye kat ou a isit la
              alt="Hatex Card" 
              className="relative w-full max-w-lg mx-auto rounded-[2rem] shadow-2xl rotate-[-2deg] hover:rotate-0 transition duration-500 border border-white/5"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-black/50 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div>
            <div className="text-red-600 text-4xl mb-4 font-black">01</div>
            <h3 className="font-black mb-2">RESEVWA LAJAN</h3>
            <p className="text-xs text-zinc-500 leading-relaxed normal-case">Entegre HatexCard nan biznis ou pou resevwa pèman rapid nan men kliyan w yo.</p>
          </div>
          <div>
            <div className="text-red-600 text-4xl mb-4 font-black">02</div>
            <h3 className="font-black mb-2">SHOP & MARKET</h3>
            <p className="text-xs text-zinc-500 leading-relaxed normal-case">Fè makèt ou nan nenpòt sipèmache oswa boutik sou entènèt ak sekirite total.</p>
          </div>
          <div>
            <div className="text-red-600 text-4xl mb-4 font-black">03</div>
            <h3 className="font-black mb-2">SEKIRITE TOTAL</h3>
            <p className="text-xs text-zinc-500 leading-relaxed normal-case">Nou itilize teknoloji chifreman ki pi avanse pou pwoteje chak santim ou genyen.</p>
          </div>
        </div>
      </section>
    </div>
  );
}