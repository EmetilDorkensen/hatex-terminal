"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function ReferralPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [referralLink, setReferralLink] = useState("Ap chaje...");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('referral_code, successful_invites, kyc_status')
            .eq('id', user.id)
            .single();
          
          if (profile) {
            setUserData(profile);
            const code = profile.referral_code || `htx_${user.id.substring(0, 6)}`;
            setReferralLink(`${window.location.origin}/signup?ref=${code}`);
          }

          const channel = supabase
            .channel(`referral_realtime_${user.id}`)
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`
            }, (payload) => {
              setUserData((prev: any) => ({ ...prev, ...payload.new }));
            })
            .subscribe();

          setLoading(false);
          return () => { supabase.removeChannel(channel); };
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error("Erè:", err);
        setLoading(false);
      }
    };
    fetchUser();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isKycApproved = userData?.kyc_status === 'approved';
  
  // STATISTIK YO
  const totalInvited = userData?.successful_invites || 0; 
  const rewardPerFriend = 150; // 150 HTG chak fwa yon moun aktive kat li
  const targetInvites = 5; // Yon sik se 5 moun (750 HTG)
  const totalEarned = totalInvited * rewardPerFriend; // Total kòb li fè deja
  
  // Kalkil pwogresyon an pou sik 5 moun lan
  const currentCycleInvites = totalInvited % targetInvites;
  const isCycleComplete = totalInvited > 0 && currentCycleInvites === 0;
  const displayInvites = isCycleComplete ? targetInvites : currentCycleInvites;
  const progressPercentage = (displayInvites / targetInvites) * 100;
  const invitesLeft = targetInvites - displayInvites;

  const copyLink = async () => {
    if (!referralLink || referralLink === "Ap chaje...") return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'HatexCard Envitasyon',
          text: 'Vini sou HatexCard! Kreye kont ou ak lyen sa a pou nou tou de ka fè kòb:',
          url: referralLink,
        });
        return;
      } catch (error) {
        console.log("Pataje anile.");
      }
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(referralLink);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = referralLink;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("Sistèm nan bloke kopye a. Tanpri seleksyone lyen an ak dwèt ou epi kopye l.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-5 font-sans italic relative overflow-x-hidden">
      
      <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-[80px] pointer-events-none -mr-20 -mt-20"></div>
      <div className="absolute top-1/3 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none -ml-20"></div>

      <div className="flex items-center gap-4 mb-6 relative z-10">
        <button onClick={() => router.back()} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 active:scale-90 transition-all">
          <span className="text-xl">←</span>
        </button>
        <h1 className="text-lg font-black uppercase tracking-widest text-red-600">Envitasyon</h1>
      </div>

      <div className="bg-zinc-900/50 backdrop-blur-md border border-white/5 p-6 rounded-[2rem] relative z-10 shadow-2xl mb-6">
        
        <div className="flex justify-between items-start mb-6">
          <div className="bg-white/10 px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">💸 Kòb Imedyat</span>
          </div>
          <div className="w-10 h-10 bg-gradient-to-tr from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <span className="text-xl drop-shadow-md">💰</span>
          </div>
        </div>

        <h2 className="text-2xl font-black uppercase leading-tight mb-2 tracking-tighter">
          Envite Zanmi & <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500">Jwenn 150 HTG pou chak</span>
        </h2>
        
        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-8 leading-relaxed">
          *Nòt: Kòb la ap moute sou balans ou otomatikman kou zanmi an fin aktive Kat Vityèl li a nan aplikasyon an.
        </p>

        <div className="bg-[#121420] p-5 rounded-3xl border border-white/5 mb-6 relative">
          <div className="flex justify-between items-end mb-3">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black text-zinc-500 tracking-widest mb-1">Total Kòb ou Fè</span>
              <span className="text-lg font-black text-green-500">+{totalEarned.toFixed(2)} <span className="text-[10px] text-zinc-500">HTG</span></span>
            </div>
            <div className="flex flex-col text-right">
               <span className="text-[12px] font-black text-white">{totalInvited} <span className="text-[10px] text-zinc-500">Zanmi Aktif</span></span>
            </div>
          </div>

          <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden mb-3 border border-white/5 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-red-600 to-yellow-500 rounded-full relative transition-all duration-1000 ease-out"
              style={{ width: `${progressPercentage}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>

          <p className="text-[10px] font-black text-yellow-500 text-center uppercase tracking-widest mt-3">
            {isCycleComplete 
              ? "Wonn nan konplete! Pataje lyen an pou kòmanse yon lòt sik." 
              : displayInvites === 0 
                ? "Pataje lyen an pou ba a kòmanse monte."
                : `Fè ${invitesLeft} lòt enskripsyon pou w atenn objektif 750 HTG a!`
            }
          </p>
        </div>

        {!isKycApproved ? (
          <div className="bg-red-600/10 border border-red-500/20 p-6 rounded-3xl text-center mt-2 mb-2">
            <div className="text-4xl mb-3">🔒</div>
            <h3 className="text-[12px] font-black text-white uppercase mb-2 tracking-widest">Lyen an Fèmen</h3>
            <p className="text-[10px] text-zinc-400 font-bold leading-relaxed mb-5">
              Ou dwe verifye idantite w (Pase KYC) anvan sistèm nan ka debloke lyen inik ou a pou w envite moun.
            </p>
            <button 
              onClick={() => router.push('/kyc')} 
              className="bg-red-600 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-red-600/20 active:scale-95 transition-all"
            >
              Al Pase KYC Kounya
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-2">Lyen Envitasyon w lan</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#121420] border border-white/5 p-4 rounded-2xl overflow-hidden">
                  <p className="text-[11px] text-zinc-300 font-mono truncate select-all">{referralLink}</p>
                </div>
                <button 
                  onClick={copyLink}
                  className={`h-12 px-5 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${copied ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-white text-black shadow-white/10'}`}
                >
                  {copied ? 'Kopye ✅' : 'Kopye'}
                </button>
              </div>
            </div>

            <button 
              onClick={copyLink}
              className="w-full bg-red-600 text-white font-black uppercase text-[12px] tracking-widest py-5 rounded-full shadow-xl shadow-red-600/20 active:scale-95 transition-all flex justify-center items-center gap-2"
            >
              Pataje Lyen ak Zanmi
            </button>
          </>
        )}

      </div>

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
              <h4 className="text-[11px] font-black text-white uppercase mb-1 tracking-wide">Yo Pase KYC epi Aktive Kat la</h4>
              <p className="text-[10px] text-zinc-400 leading-relaxed font-bold">Lè zanmi w lan fin verifye idantite l, li dwe peye frè 520 Goud la pou l aktive kat vityèl li a.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[10px] font-black text-red-500 flex-shrink-0">3</div>
            <div>
              <h4 className="text-[11px] font-black text-white uppercase mb-1 tracking-wide">Ou Jwenn 150 HTG Imedyatman!</h4>
              <p className="text-[10px] text-zinc-400 leading-relaxed font-bold">Nan menm segonn zanmi an peye 520 goud la, sistèm nan ap transfere 150 HTG otomatikman sou vrè balans ou. Ou pa bezwen tann 5 moun ankò pou w touché!</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}