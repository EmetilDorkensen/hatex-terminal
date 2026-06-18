"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Megaphone, Download, Image as ImageIcon } from 'lucide-react';

export default function PresPage() {
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
        <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter mb-4"><span className="text-red-600">Pres</span> & Medya</h1>
        <p className="text-zinc-400 mb-12 italic border-l-4 border-red-600 pl-4 font-bold text-sm">Resous ofisyèl pou laprès ak patnè yo.</p>

        <div className="bg-[#121420] p-8 rounded-[2rem] border border-white/5 mb-8">
          <div className="flex items-center gap-3 mb-6 text-red-500"><Megaphone size={24} /><h2 className="text-xl font-black uppercase tracking-widest text-white">Sou HatexCard (Boilerplate)</h2></div>
          <p className="text-zinc-300 leading-relaxed mb-4 text-sm md:text-base">Lanse nan entansyon pou revolisyone teknoloji finansye (FinTech) an Ayiti, HatexCard se yon platfòm konplè ki ofri kat vityèl, faktirasyon entelijan (Smart Invoice), ak solisyon B2B pou e-commerce. Tout operasyon nou yo santre sou sekirite, transparans, ak devlopman ekonomik lokal.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900/50 p-8 rounded-[2rem] border border-white/5 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center mb-4"><ImageIcon size={28} /></div>
            <h2 className="text-lg font-black uppercase text-white mb-2">Media Kit</h2>
            <p className="text-zinc-500 text-xs font-bold mb-6 px-4">Telechaje logo ofisyèl nou yo, koulè mak la, ak foto entèfas platfòm nan.</p>
            <button className="bg-white hover:bg-zinc-200 text-black px-8 py-4 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-95"><Download size={14} /> Telechaje Kounye A</button>
          </div>

          <div className="bg-zinc-900/50 p-8 rounded-[2rem] border border-white/5 flex flex-col justify-center">
            <h2 className="text-lg font-black uppercase text-white mb-4">Kontak Laprès</h2>
            <p className="text-zinc-400 text-sm mb-6">Pou tout demann entèvyou, atik, oswa repòtaj sou HatexCard, tanpri ekri nou dirèkteman. Ekip nou an ap reponn ou nan 24 èdtan.</p>
            <div className="bg-black p-4 rounded-xl border border-white/10 font-mono text-sm text-red-400 font-bold">suppoer@hatexcard.com</div>
          </div>
        </div>
      </div>
    </div>
  );
}