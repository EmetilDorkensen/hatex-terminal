"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReferralPage() {
  const router = useRouter();
  
  // TÈS DONE: Pou kounye a, nou mete moun nan gen 2 zanmi ki gentan pase KYC (2 x 300 = 600 HTG)
  // Ou ka konekte sa ak Supabase pita.
  const [totalInvited, setTotalInvited] = useState(2); 
  const targetAmount = 1500;
  const targetInvites = 5;
  const currentAmount = totalInvited * (targetAmount / targetInvites); // 600 HTG
  const invitesLeft = targetInvites - totalInvited; // 3 rete
  const progressPercentage = (currentAmount / targetAmount) * 100;

  const referralLink = "https://hatexcard.com/join/dorkensen8273"; // Egzanp lyen

  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-5 font-sans italic relative overflow-x-hidden">
      
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-[80px] pointer-events-none -mr-20 -mt-20"></div>
      <div className="absolute top-1/3 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none -ml-20"></div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6 relative z-10">
        <button onClick={() => router.back()} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 active:scale-90 transition-all">
          <span className="text-xl">←</span>
        </button>
        <h1 className="text-lg font-black uppercase tracking-widest text-red-600">Envitasyon</h1>
      </div>

      {/* Main Card */}
      <div className="bg-zinc-900/50 backdrop-blur-md border border-white/5 p-6 rounded-[2rem] relative z-10 shadow-2xl mb-6">
        
        {/* 45 Days Tag */}
        <div className="flex justify-between items-start mb-6">
          <div className="bg-white/10 px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">⏱️ 45 Jou Rete</span>
          </div>
          <div className="w-10 h-10 bg-gradient-to-tr from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <span className="text-xl drop-shadow-md">💰</span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black uppercase leading-tight mb-2 tracking-tighter">
          Envite Zanmi & <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500">Jwenn 1,500 HTG</span>
        </h2>
        
        {/* Warning Note */}
        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-8 leading-relaxed">
          *Nòt: Kòb sa a pap monte sou vrè balans ou toutotan ba pwogresyon an pa rive nan 1,500 HTG nèt. (5 zanmi kap pase KYC).
        </p>

        {/* Progress Bar Section */}
        <div className="bg-[#121420] p-5 rounded-3xl border border-white/5 mb-6 relative">
          <div className="flex justify-between items-end mb-3">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black text-zinc-500 tracking-widest mb-1">Pwogresyon</span>
              <span className="text-lg font-black text-white">{currentAmount.toFixed(2)} <span className="text-[10px] text-zinc-500">/ 1,500.00 HTG</span></span>
            </div>
          </div>

          {/* Bar */}
          <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden mb-3 border border-white/5">
            <div 
              className="h-full bg-gradient-to-r from-red-600 to-yellow-500 rounded-full relative transition-all duration-1000"
              style={{ width: `${progressPercentage}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>

          <p className="text-[10px] font-black text-yellow-500 text-center uppercase tracking-widest">
            Fè {invitesLeft} lòt enskripsyon pou debloke kòb la!
          </p>
        </div>

        {/* Link Box */}
        <div className="mb-6">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-2">Lyen Envitasyon w lan</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#121420] border border-white/5 p-4 rounded-2xl overflow-hidden">
              <p className="text-[11px] text-zinc-300 font-mono truncate">{referralLink}</p>
            </div>
            <button 
              onClick={copyLink}
              className={`h-12 px-5 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${copied ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-white text-black shadow-white/10'}`}
            >
              {copied ? 'Kopye ✅' : 'Kopye'}
            </button>
          </div>
        </div>

        {/* Share Button */}
        <button 
          onClick={copyLink}
          className="w-full bg-red-600 text-white font-black uppercase text-[12px] tracking-widest py-5 rounded-full shadow-xl shadow-red-600/20 active:scale-95 transition-all flex justify-center items-center gap-2"
        >
          Pataje Lyen ak Zanmi
        </button>

      </div>

      {/* Rules / Steps */}
      <div className="px-2 pb-10">
        <h3 className="text-[12px] font-black text-white uppercase tracking-widest mb-5">Kòman sa mache?</h3>
        
        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[10px] font-black text-red-500 flex-shrink-0">1</div>
            <div>
              <h4 className="text-[11px] font-black text-white uppercase mb-1 tracking-wide">Pataje lyen an</h4>
              <p className="text-[10px] text-zinc-400 leading-relaxed font-bold">Voye lyen w lan bay zanmi w yo pou yo ka telechaje HatexCard epi kreye yon kont.</p>
            </div>
          </div>
          
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[10px] font-black text-red-500 flex-shrink-0">2</div>
            <div>
              <h4 className="text-[11px] font-black text-white uppercase mb-1 tracking-wide">Yo Pase Verifikasyon (KYC)</h4>
              <p className="text-[10px] text-zinc-400 leading-relaxed font-bold">Lè zanmi w lan fin kreye kont lan, fòk li soumèt pyès idantite l (Pase KYC) pou kont lan ka aktive.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[10px] font-black text-red-500 flex-shrink-0">3</div>
            <div>
              <h4 className="text-[11px] font-black text-white uppercase mb-1 tracking-wide">Jwenn Rekonpans la</h4>
              <p className="text-[10px] text-zinc-400 leading-relaxed font-bold">Lè 5 zanmi w yo fin pase KYC yo nèt (Ba a rive 1500 HTG), kòb la ap transfere nan vrè balans ou otomatikman.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}