"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, Code, Headset, Zap } from 'lucide-react';

export default function TravayPage() {
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
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-4">Vin Konstwi <span className="text-red-600">Avni An</span></h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">Nan HatexCard, nou pa jis ekri kòd; nou ap bati yon enfrastrikti ki pral chanje lavi dè milyon moun an Ayiti. Nou se yon ekip jèn, dinamik, ak pasyone ki pa pè rezoud gwo pwoblèm.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-[#121420] p-6 rounded-3xl border border-white/5 text-center"><div className="w-12 h-12 mx-auto bg-zinc-800 text-white rounded-full flex items-center justify-center mb-4"><Zap size={20}/></div><h3 className="font-black uppercase text-sm mb-2">Kilti Inovatif</h3><p className="text-xs text-zinc-500">Travay fleksib e ki santre sou rezilta ak kreyasyon.</p></div>
          <div className="bg-[#121420] p-6 rounded-3xl border border-white/5 text-center"><div className="w-12 h-12 mx-auto bg-zinc-800 text-white rounded-full flex items-center justify-center mb-4"><Code size={20}/></div><h3 className="font-black uppercase text-sm mb-2">Teknoloji Dènye Kri</h3><p className="text-xs text-zinc-500">Opòtinite pou w travay avèk Next.js, Supabase, ak API solid.</p></div>
          <div className="bg-[#121420] p-6 rounded-3xl border border-white/5 text-center"><div className="w-12 h-12 mx-auto bg-zinc-800 text-white rounded-full flex items-center justify-center mb-4"><Briefcase size={20}/></div><h3 className="font-black uppercase text-sm mb-2">Enpak Reyèl</h3><p className="text-xs text-zinc-500">Pwodwi w bati yo ap ede devlope komès ak ekonomi an dirèk.</p></div>
        </div>

        <h2 className="text-2xl font-black uppercase italic border-b border-white/10 pb-4 mb-8 text-white">Pòs ki Ouvri yo</h2>
        
        <div className="space-y-4 mb-12">
          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 hover:border-red-500/30 transition-all flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto"><div className="w-12 h-12 bg-red-600/10 text-red-500 rounded-xl flex items-center justify-center shrink-0"><Headset size={20}/></div><div><h3 className="font-black uppercase text-white">Ajan Sipò Kliyan</h3><p className="text-[10px] text-zinc-400 font-bold tracking-widest mt-1">AN LIY / REMOTE</p></div></div>
            <button className="w-full md:w-auto px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all">Postile</button>
          </div>
          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 hover:border-red-500/30 transition-all flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto"><div className="w-12 h-12 bg-red-600/10 text-red-500 rounded-xl flex items-center justify-center shrink-0"><Code size={20}/></div><div><h3 className="font-black uppercase text-white">Devlopè Web / API</h3><p className="text-[10px] text-zinc-400 font-bold tracking-widest mt-1">FREELANCE / REMOTE</p></div></div>
            <button className="w-full md:w-auto px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all">Postile</button>
          </div>
        </div>

        <div className="bg-red-900/20 border border-red-500/30 p-8 rounded-[2rem] text-center">
          <p className="text-sm font-bold text-white mb-2">Ou pa wè yon pòs ki koresponn ak pwofil ou men ou vle travay avèk nou?</p>
          <p className="text-xs text-zinc-400 mb-6">Voye CV w ak yon ti lèt motivasyon dirèkteman ban nou.</p>
          <a href="mailto:jobs@hatexcard.com" className="inline-block bg-red-600 text-white px-8 py-4 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg shadow-red-600/20">jobs@hatexcard.com</a>
        </div>
      </div>
    </div>
  );
}