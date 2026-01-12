"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { createBrowserClient } from '@supabase/ssr';

export default function Dashboard() { // Fonksyon dwe kòmanse ak Majiskil
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isActivated, setIsActivated] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profile) {
            setUserData(profile);
            setIsActivated(profile.kyc_status === 'approved');
          }
        }
      } catch (err) {
        console.error("Erè grav:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserAndProfile();
  }, [supabase]);

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
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans relative flex flex-col italic">
      
      {/* 1. HEADER */}
      <div className="p-6 pb-0">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full border-2 border-red-600 p-0.5 bg-zinc-900 overflow-hidden flex items-center justify-center font-black">
                {userData?.full_name?.charAt(0) || "H"}
            </div>
            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest leading-none italic">Byenvini 👋</p>
              <h2 className="font-bold text-[12px] uppercase italic mt-1 tracking-wide">
                {userData?.full_name || "Kliyan Hatex"}
              </h2>
            </div>
          </div>
          <button 
            onClick={() => setShowNumbers(!showNumbers)}
            className="w-10 h-10 bg-zinc-900/50 rounded-full border border-zinc-800 flex items-center justify-center active:scale-90 transition-all"
          >
            <span className="text-zinc-400 text-lg">{showNumbers ? "🔒" : "👁️"}</span>
          </button>
        </div>

        {/* 2. BALANS WALLET */}
        <div className="bg-zinc-900/30 backdrop-blur-md p-6 rounded-[2.5rem] mb-6 border border-white/5 relative overflow-hidden">
          <p className="text-[14px] uppercase text-zinc-500 font-black mb-1.5 tracking-[0.2em]">Balans Wallet</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-5xl font-black italic tracking-tighter">
              {userData?.wallet_balance?.toLocaleString() || "0.00"}
            </h3>
            <span className="text-[12px] font-bold text-red-600 uppercase italic">Goud</span>
          </div>
        </div>

        {/* 3. AKSYON YO */}
        <div className="flex flex-row justify-between gap-3 mb-10">
          <button onClick={() => router.push('/deposit')} className="flex-1 bg-red-600 py-6 rounded-[2rem] flex items-center justify-center text-white active:scale-95 transition-all">
            <span className="text-[14px] font-black uppercase italic tracking-widest">Depo</span>
          </button>
          <button onClick={() => router.push('/withdraw')} className="flex-1 bg-red-600 py-6 rounded-[2rem] flex items-center justify-center text-white active:scale-95 transition-all">
            <span className="text-[14px] font-black uppercase italic tracking-widest">Retrè</span>
          </button>
          <button onClick={() => router.push('/transfert')} className="flex-1 bg-white py-6 rounded-[2rem] flex items-center justify-center text-red-600 active:scale-95 transition-all">
            <span className="text-[14px] font-black uppercase italic tracking-widest">Transfè</span>
          </button>
        </div>

        {/* 4. KAT VITYÈL */}
        <div className="mb-10 perspective-1000">
            <p className="text-[11px] font-black uppercase italic text-zinc-500 mb-4 ml-2 tracking-widest flex justify-between">
              <span>Ma Carte Hatex</span>
              {isActivated && <span className="text-red-600 animate-pulse text-[9px]">Tap pou vire</span>}
            </p>
            
            <div className="relative aspect-[1.58/1] w-full">
              {!isActivated && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[2.5rem] bg-black/60 backdrop-blur-sm border border-white/10">
                  <p className="text-[10px] font-black uppercase mb-4 tracking-widest text-white/90">
                    {userData?.kyc_status === 'pending' ? "Verifikasyon an kous..." : "Aktivasyon Obligatwa"}
                  </p>
                  <button onClick={() => router.push('/kyc')} className="bg-red-600 text-white px-8 py-3 rounded-full font-black text-[11px] uppercase shadow-2xl active:scale-90 transition-all">
                    Aktive Kat Kounye a
                  </button>
                </div>
              )}

              <div 
                className={`relative h-full w-full transition-all duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
                onClick={() => isActivated && setIsFlipped(!isFlipped)}
              >
                {/* DEVAN */}
                <div className="absolute inset-0 backface-hidden rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-zinc-800 to-black p-8 shadow-2xl border border-white/10">
                    <div className={`flex flex-col h-full justify-between ${!isActivated ? 'blur-md opacity-40' : ''}`}>
                        <div className="flex justify-between items-start">
                          <div className="w-10 h-8 bg-gradient-to-tr from-yellow-600 to-yellow-200 rounded-md opacity-80" />
                          <h2 className="text-[14px] font-black italic text-red-600 uppercase">HATEX</h2>
                        </div>
                        <p className="text-2xl font-mono font-bold tracking-[0.2em] text-white">
                          {formatCardNumber(userData?.card_number)}
                        </p>
                        <div className="flex justify-between items-end">
                           <div>
                              <p className="text-[7px] opacity-50 uppercase font-black">Pwopriyetè</p>
                              <p className="text-[10px] font-black uppercase italic text-white">{userData?.full_name || "MEMBER"}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[7px] opacity-50 uppercase font-black italic">Validite</p>
                              <p className="text-[10px] font-bold">{isActivated ? userData?.card_expiry : "**/**"}</p>
                           </div>
                        </div>
                    </div>
                </div>

                {/* DÈYÈ */}
                <div className="absolute inset-0 rotate-y-180 backface-hidden rounded-[2.5rem] bg-zinc-900 p-8 border border-white/10 flex flex-col items-center justify-center shadow-2xl">
                    <div className="w-full h-10 bg-black absolute top-6 left-0"></div>
                    <div className="mt-8 bg-white p-2 rounded-xl">
                       <QRCodeSVG value={`https://hatex.me/pay/${userData?.id}`} size={90} level="H" />
                    </div>
                    <p className="text-[8px] font-black uppercase mt-4 text-zinc-500 tracking-widest italic">Scan to Pay</p>
                </div>
              </div>
            </div>
        </div>

        {/* 5. NAVIGASYON ANBA */}
        <div className="fixed bottom-6 left-6 right-6 bg-zinc-900/90 backdrop-blur-2xl border border-white/5 h-20 rounded-[2.5rem] flex justify-between items-center px-8 z-50 shadow-2xl">
          <div className="flex flex-col items-center gap-1 text-red-600">
              <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
              <span className="text-[9px] font-black uppercase">Akey</span>
          </div>
          <div onClick={() => router.push('/kat')} className="flex flex-col items-center gap-1 opacity-40 cursor-pointer">
            <span className="text-[9px] font-black uppercase text-white">Kat</span>
          </div>
          <div onClick={() => router.push('/terminal')} className="relative -mt-12 cursor-pointer">
            <div className="bg-red-600 w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-red-600/40 rotate-45">
                <span className="text-2xl font-black -rotate-45 text-white">T</span>
            </div>
          </div>
          <div onClick={() => router.push('/transactions')} className="flex flex-col items-center gap-1 opacity-40 cursor-pointer">
            <span className="text-[9px] font-black uppercase text-white">Istorik</span>
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }} className="flex flex-col items-center gap-1 opacity-60">
            <span className="text-[9px] font-black uppercase text-red-500">Soti</span>
          </button>
        </div>

      </div>

      <style jsx>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}