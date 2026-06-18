"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, ArrowRight } from 'lucide-react';

export default function BlogPage() {
  const router = useRouter();

  const posts = [
    { id: 1, title: "Kòman pou w ogmante lavant ou ak Plugin WooCommerce HatexCard la", date: "15 Jen 2026", category: "E-Commerce", desc: "Dekouvri kòman entegre peman an Goud dirèkteman sou sit entènèt ou ka diminye kantite moun ki abandone panyen yo epi fè kliyan yo achte pi fasil." },
    { id: 2, title: "Peman ak QR Kòd: Poukisa li pi an sekirite pase Lajan Kach", date: "10 Jen 2026", category: "Sekirite", desc: "Lajan kach ka pèdi, li ka chire, e li riske. Aprann kòman sistèm QR kòd HatexCard la pwoteje machann yo kont fo biyè ak vòl, nan mwens pase 3 segonn." },
    { id: 3, title: "5 Fason pou Pwoteje Kont Finansye w sou Entènèt", date: "02 Jen 2026", category: "Konsèy", desc: "Ekip sekirite HatexCard la pataje meyè pratik pou w jere modpas ou, kòd PIN ou, ak kòman pou evite fwod sou entènèt." }
  ];

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans selection:bg-red-600/30 pb-20">
      <div className="sticky top-0 z-50 bg-[#0a0b14]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <button onClick={() => router.push('/')} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-white/5 hover:bg-zinc-800 transition-all text-white"><ArrowLeft size={18} /></button>
          <span className="font-black italic tracking-widest uppercase">Blog</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 md:p-8 mt-8">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-16 h-16 bg-red-600 rounded-[1.2rem] flex items-center justify-center shadow-lg shadow-red-600/30"><BookOpen size={32} /></div>
          <div><h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter">Hatex<span className="text-red-600">Blog</span></h1><p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mt-1">Nouvèl ak Konsèy</p></div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {posts.map(post => (
            <div key={post.id} className="bg-[#121420] p-6 md:p-8 rounded-[2rem] border border-white/5 hover:border-red-500/30 transition-all group cursor-pointer shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-3 py-1 rounded-md">{post.category}</span>
                <span className="text-[10px] font-bold text-zinc-500">{post.date}</span>
              </div>
              <h2 className="text-xl font-black text-white mb-3 group-hover:text-red-500 transition-colors leading-tight">{post.title}</h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">{post.desc}</p>
              <button className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2 group-hover:gap-4 transition-all">Li plis <ArrowRight size={14} className="text-red-500"/></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}