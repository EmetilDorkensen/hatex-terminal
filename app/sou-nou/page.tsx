"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Target, Eye, Info } from 'lucide-react';

export default function SouNouPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans selection:bg-red-600/30 pb-20">
      <div className="sticky top-0 z-50 bg-[#0a0b14]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <button onClick={() => router.push('/')} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-white/5 hover:bg-zinc-800 transition-all text-white"><ArrowLeft size={18} /></button>
          <span className="font-black italic tracking-widest uppercase">Konpayi</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 md:p-8 mt-8">
        <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-4">Konstwi Avni Finansye <span className="text-red-600">Ayiti</span></h1>
        <p className="text-zinc-400 text-lg md:text-xl font-bold mb-12 italic border-l-4 border-red-600 pl-4">Yon tranzaksyon alafwa.</p>

        <div className="space-y-8">
          <div className="bg-zinc-900/50 p-8 rounded-[2rem] border border-white/5">
            <div className="flex items-center gap-3 mb-4 text-red-500"><Info size={24} /><h2 className="text-2xl font-black uppercase tracking-widest text-white">Kiyès Nou Ye</h2></div>
            <p className="text-zinc-300 leading-relaxed">HatexCard se yon ekosistèm peman dijital inovatè ki fèt espesyalman pou reyalite mache ayisyen an. Nan yon mond k ap vanse rapid ak teknoloji, nou kwè chak Ayisyen dwe gen aksè ak zouti finansye modèn, rapid, epi an sekirite san yo pa bezwen pase anba tout baryè sistèm labank tradisyonèl yo.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-[#121420] to-black p-8 rounded-[2rem] border border-white/5 shadow-xl shadow-red-900/5">
              <div className="w-12 h-12 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center mb-6"><Target size={24} /></div>
              <h2 className="text-xl font-black uppercase tracking-widest text-white mb-4">Misyon Nou</h2>
              <p className="text-zinc-400 leading-relaxed text-sm">Fasilite komès lokal la lè nou bay antreprenè, machann, ak kliyan yon mwayen pou yo voye ak resevwa lajan 100% an Goud (HTG) san konplikasyon. Soti nan kat vityèl pou rive nan peman QR kòd ak entegrasyon e-commerce, nou ap konekte ekonomi ayisyen an ak mond dijital la.</p>
            </div>

            <div className="bg-gradient-to-br from-[#121420] to-black p-8 rounded-[2rem] border border-white/5 shadow-xl shadow-red-900/5">
              <div className="w-12 h-12 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center mb-6"><Eye size={24} /></div>
              <h2 className="text-xl font-black uppercase tracking-widest text-white mb-4">Vizyon Nou</h2>
              <p className="text-zinc-400 leading-relaxed text-sm">Vin premye motè finansye nasyonal ki pèmèt nenpòt ti biznis tounen yon gwo antrepriz grasa teknoloji, epi bay chak sitwayen kontwòl total sou kòb yo kèlkeswa kote yo ye sou teritwa a.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}