"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, MessageCircle, MapPin, Briefcase } from 'lucide-react';

export default function KontaktePage() {
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
        <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-4">Nou La Pou <span className="text-red-600">Ede W!</span></h1>
        <p className="text-zinc-400 text-sm md:text-base font-bold mb-12 italic border-l-4 border-red-600 pl-4">Èske w gen yon pwoblèm ak yon tranzaksyon oswa ou vle entegre API nou an? Ekip nou an toujou prè.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-[#121420] p-8 rounded-[2rem] border border-white/5 relative overflow-hidden group hover:border-red-500/30 transition-all">
            <div className="w-14 h-14 bg-red-600/10 text-red-500 rounded-2xl flex items-center justify-center mb-6"><MessageCircle size={24}/></div>
            <h2 className="text-xl font-black uppercase tracking-widest text-white mb-2">Sipò Kliyan</h2>
            <p className="text-zinc-500 text-xs font-bold mb-6">Pou kesyon sou kont ou, depo, ak retrè.</p>
            <div className="space-y-4">
              <a href="mailto:support@hatexcard.com" className="flex items-center gap-3 text-sm font-bold text-zinc-300 hover:text-white transition-colors bg-black p-4 rounded-xl border border-white/5"><Mail size={16} className="text-red-500"/> support@hatexcard.com</a>
              <a href="https://wa.me/50937201241" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm font-bold text-zinc-300 hover:text-white transition-colors bg-black p-4 rounded-xl border border-white/5"><MessageCircle size={16} className="text-green-500"/> +509 3720 1241 (Lendi-Samdi)</a>
            </div>
          </div>

          <div className="bg-[#121420] p-8 rounded-[2rem] border border-white/5 relative overflow-hidden group hover:border-blue-500/30 transition-all">
            <div className="w-14 h-14 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6"><Briefcase size={24}/></div>
            <h2 className="text-xl font-black uppercase tracking-widest text-white mb-2">Biznis & Patenarya</h2>
            <p className="text-zinc-500 text-xs font-bold mb-6">Pou entegrasyon API, e-commerce, ak gwo antrepriz.</p>
            <div className="space-y-4">
              <a href="mailto:business@hatexcard.com" className="flex items-center gap-3 text-sm font-bold text-zinc-300 hover:text-white transition-colors bg-black p-4 rounded-xl border border-white/5"><Mail size={16} className="text-blue-500"/> business@hatexcard.com</a>
            </div>
          </div>

        </div>

        <div className="mt-8 bg-zinc-900/50 p-8 rounded-[2rem] border border-white/5 flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 text-white rounded-full flex items-center justify-center shrink-0"><MapPin size={20}/></div>
            <div>
              <h2 className="text-lg font-black uppercase text-white">Biwo Prensipal</h2>
              <p className="text-sm text-zinc-400">Gonaïves, Repiblik Ayiti</p>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest max-w-xs md:text-right">
            Nou se yon platfòm prensipalman dijital k ap sèvi itilizatè nan tout 10 depatman yo.
          </p>
        </div>
      </div>
    </div>
  );
}