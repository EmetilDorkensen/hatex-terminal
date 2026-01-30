"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { QRCodeSVG } from 'qrcode.react';

export default function KatPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Nou rale pwofil la ak tout balans yo
          let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profile) {
            setUserData({ ...profile, email: user.email });
          }
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error("Erè:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserAndProfile();
  }, [supabase, router]);

  const isActivated = userData?.kyc_status === 'approved';

  const formatCardNumber = (num: string) => {
    if (!num) return "**** **** **** ****";
    if (showNumbers) return num.match(/.{1,4}/g)?.join(' ');
    return `${num.substring(0, 4)} **** **** ${num.substring(12, 16)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans relative flex flex-col italic overflow-x-hidden p-5">
      
      {/* HEADER AK BOUTON RETOU */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => router.push('/dashboard')}
          className="w-12 h-12 bg-zinc-900/50 rounded-2xl border border-white/5 flex items-center justify-center active:scale-90 transition-all"
        >
          <span className="text-xl">←</span>
        </button>
        <div className="text-center">
          <h1 className="text-[12px] font-black uppercase tracking-[0.3em] text-red-600">HatexCard</h1>
          <p className="text-[8px] text-zinc-500 uppercase font-bold">Virtual Debit Card</p>
        </div>
        <div className="w-12 h-12"></div> {/* Pou balans header a */}
      </div>

      {/* BALANS KAT LA (SEPARE) */}
      <div className="bg-gradient-to-b from-zinc-900/50 to-transparent p-8 rounded-[2.5rem] border border-white/5 mb-8 text-center backdrop-blur-md">
         <p className="text-[10px] uppercase text-zinc-500 font-black mb-2 tracking-widest">Balans Sou Kat la</p>
         <h2 className="text-5xl font-black italic tracking-tighter">
            {userData?.card_balance ? Number(userData.card_balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : "0.00"}
            <span className="text-[12px] text-red-600 ml-2 uppercase font-black">HTG</span>
         </h2>
      </div>

      {/* KAT LA (ANIMASYON KONPLÈ) */}
      <div className="mb-10 perspective-1000">
        <div className="relative aspect-[1.58/1] w-full max-w-[400px] mx-auto">
          {!isActivated && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-[2.5rem] bg-black/80 backdrop-blur-md p-6 text-center border border-white/5">
              <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center text-red-600 mb-4 animate-bounce">🔒</div>
              <p className="text-[10px] font-black uppercase mb-4 tracking-widest text-zinc-400">
                {userData?.kyc_status === 'pending' ? "Verifikasyon KYC an kous..." : "Ou dwe verifye idantite w"}
              </p>
              <button 
                onClick={() => router.push('/kyc')}
                className="bg-white text-black px-10 py-4 rounded-full font-black text-[10px] uppercase shadow-2xl active:scale-95 transition-all"
              >
                Aktive Kat Sa Kounye a
              </button>
            </div>
          )}

          <div
            className={`relative h-full w-full transition-all duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
            onClick={() => isActivated && setIsFlipped(!isFlipped)}
          >
            {/* DEVAN KAT LA */}
            <div className="absolute inset-0 backface-hidden rounded-[2.5rem] overflow-hidden bg-gradient-to-tr from-red-700 via-red-600 to-zinc-950 p-8 shadow-[0_20px_50px_rgba(220,38,38,0.15)] border border-white/10">
                <div className={`flex flex-col h-full justify-between ${!isActivated ? 'blur-lg' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="w-14 h-14 bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center overflow-hidden backdrop-blur-md">
                         <img src="https://i.imgur.com/xDk58Xk.png" alt="Logo" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-right">
                        <h2 className="text-[12px] font-black italic tracking-tighter uppercase font-mono">HatexCard</h2>
                        <p className="text-[7px] font-bold opacity-50 uppercase">Virtual Platinum</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-xl sm:text-2xl font-mono font-bold tracking-[0.2em] drop-shadow-md">
                          {formatCardNumber(userData?.card_number)}
                        </p>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowNumbers(!showNumbers); }}
                          className="w-10 h-10 bg-black/20 rounded-full flex items-center justify-center text-sm"
                        >
                          {showNumbers ? "🔒" : "👁️"}
                        </button>
                      </div>

                      <div className="flex justify-between items-end">
                        <div className="max-w-[180px]">
                           <p className="text-[7px] opacity-60 uppercase font-black mb-1 tracking-widest">Card Holder</p>
                           <p className="text-[11px] font-black uppercase truncate">{userData?.full_name}</p>
                        </div>
                        <div className="flex gap-5 text-right">
                           <div>
                              <p className="text-[7px] opacity-60 uppercase font-black mb-1">Expires</p>
                              <p className="text-[10px] font-black">{isActivated ? userData?.exp_date : "**/**"}</p>
                           </div>
                           <div>
                              <p className="text-[7px] opacity-60 uppercase font-black mb-1">CVV</p>
                              <p className="text-[10px] font-black">{showNumbers ? userData?.cvv : "***"}</p>
                           </div>
                        </div>
                      </div>
                    </div>
                </div>
            </div>

            {/* DÈYÈ KAT LA */}
            <div className="absolute inset-0 rotate-y-180 backface-hidden rounded-[2.5rem] bg-[#12131a] p-8 border border-white/10 flex flex-col items-center justify-between shadow-2xl">
                <div className="w-full h-14 bg-black absolute top-10 left-0"></div>
                <div className="w-full h-10 bg-zinc-800/50 rounded-lg mt-20 flex items-center px-4">
                   <div className="w-2/3 h-1 bg-zinc-700 rounded-full"></div>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white p-3 rounded-2xl shadow-xl">
                     <QRCodeSVG value={`Card:${userData?.card_number}`} size={110} />
                  </div>
                  <p className="text-[9px] font-black uppercase text-red-600 tracking-[0.4em] animate-pulse">Scan to Pay</p>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOUTON RECHAJE AK ENFO */}
      {isActivated && (
        <div className="space-y-4 mt-auto pb-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
           <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-[3rem] backdrop-blur-xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
             
             <div className="flex items-center gap-4 mb-8">
               <div className="w-12 h-12 bg-red-600 rounded-[1.2rem] flex items-center justify-center shadow-lg shadow-red-600/30 rotate-12">
                 <span className="text-white text-xl -rotate-12">⚡</span>
               </div>
               <div>
                 <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest leading-none mb-1">Wallet Prensipal</p>
                 <p className="text-[14px] font-black italic">{Number(userData?.wallet_balance || 0).toLocaleString()} HTG</p>
               </div>
             </div>

             <button 
               onClick={() => router.push('/kat/recharge')}
               className="w-full bg-white text-black py-6 rounded-[2rem] font-black uppercase italic text-[13px] tracking-widest shadow-2xl active:scale-95 transition-all hover:bg-red-50"
             >
               Rechaje Kat la
             </button>
           </div>
           
           <div className="flex items-center justify-center gap-2 py-4">
             <span className="w-1 h-1 bg-zinc-800 rounded-full"></span>
             <p className="text-[8px] text-zinc-600 font-black uppercase italic tracking-widest">Sistèm HatexCard™ Secure 256-bit</p>
             <span className="w-1 h-1 bg-zinc-800 rounded-full"></span>
           </div>
        </div>
      )}

      <style jsx>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}