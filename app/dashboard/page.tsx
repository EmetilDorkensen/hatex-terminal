"use client";

import React, { useState, useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { QRCodeSVG } from 'qrcode.react';

import { createBrowserClient } from '@supabase/ssr';



export default function

dashboard() {

  const router = useRouter();

  const supabase = createBrowserClient(

    process.env.NEXT_PUBLIC_SUPABASE_URL!,

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  );



  const [userData, setUserData] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  const [isActivated, setIsActivated] = useState(false);

  const [isFlipped, setIsFlipped] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [showNumbers, setShowNumbers] = useState(false); // Pou Show/Hide



  useEffect(() => {

    const fetchUserAndProfile = async () => {

      try {

        const { data: { user } } = await supabase.auth.getUser();

        if (user) {

          // Nou rekipere tout kolòn yo nèt

          let { data: profile, error: fetchError } = await supabase

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



  // Fonksyon pou kache chif kat la

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

          <button

            onClick={() => setIsMenuOpen(true)}

            className="w-10 h-10 flex flex-col items-start justify-center gap-1.5 active:scale-90 transition-all"

          >

            <div className="w-8 h-0.5 bg-white rounded-full"></div>

            <div className="w-5 h-0.5 bg-red-600 rounded-full"></div>

            <div className="w-8 h-0.5 bg-white rounded-full"></div>

          </button>

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

            className="w-10 h-10 bg-zinc-900/50 rounded-full border border-zinc-800 flex items-center justify-center relative active:scale-90 transition-all"

          >

            <span className="text-zinc-400 text-lg">{showNumbers ? "🔒" : "👁️"}</span>

          </button>

        </div>

{userData?.email === "hatexcard@gmail.com" && (
          <button 
            onClick={() => router.push('/admin')}
            className="w-full mb-8 bg-red-600/10 border border-red-600/50 py-4 rounded-3xl font-black text-red-500 uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-red-600/5 active:scale-95 transition-all"
          >
            🛡️ Panèl Kontwòl Admin
          </button>
        )}

        {/* 2. BALANS WALLET */}

        <div className="bg-zinc-900/30 backdrop-blur-md p-6 rounded-[2.5rem] mb-6 border border-white/5 relative overflow-hidden">

          <p className="text-[14px] uppercase text-zinc-500 font-black mb-1.5 tracking-[0.2em]">Balans Wallet</p>

          <div className="flex items-baseline gap-2">

            <h3 className="text-6xl font-black italic tracking-tighter">

              {userData?.wallet_balance?.toLocaleString() || "0.00"}

            </h3>

            <span className="text-[12px] font-bold text-red-600 uppercase italic">Goud</span>

          </div>

        </div>

        {/* 3. TWA BOUTON AKSYON YO */}

<div className="flex flex-row justify-between gap-3 mb-10">

  {/* Bouton Depo - Verifye si folder ou a rele 'deposit' oswa 'depot' */}

  <button

    onClick={() => router.push('/deposit')}

    className="flex-1 bg-red-600 py-8 rounded-[4rem] flex items-center justify-center text-white active:scale-95 transition-all shadow-lg shadow-red-600/20"

  >

    <span className="text-[16px] font-black uppercase italic tracking-widest">Depo</span>

  </button>

  {/* Bouton Retrè - Kounye a li pral chèche folder 'withdraw' la */}

  <button

    onClick={() => router.push('/withdraw')}

    className="flex-1 bg-red-600 py-8 rounded-[4rem] flex items-center justify-center text-white active:scale-95 transition-all shadow-lg shadow-red-600/20"

  >

    <span className="text-[16px] font-black uppercase italic tracking-widest">Retrè</span>

  </button>

  {/* Bouton Transfè */}

  <button

    onClick={() => router.push('/transfert')}

    className="flex-1 bg-white py-8 rounded-[4rem] flex items-center justify-center text-red-600 shadow-xl active:scale-95 transition-all"

  >

    <span className="text-[16px] font-black uppercase italic text-red-600 tracking-widest">Transfè</span>

  </button>

</div>

        {/* 4. KAT VITYÈL DOUBLE FAS */}

        <div className="mb-10 perspective-1000 relative">

            <p className="text-[11px] font-black uppercase italic text-zinc-500 mb-4 ml-2 tracking-widest flex justify-between">

              <span>Kat Vityèl</span>

              {isActivated && <span className="text-red-600 animate-pulse">Klike pou vire</span>}

            </p>
            <div className="relative aspect-[1.58/1] w-full">

              {!isActivated && (

                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[2.5rem] bg-black/40 backdrop-blur-sm">

                  <p className="text-[8px] font-black uppercase mb-3 tracking-widest text-white/90">

                    {userData?.kyc_status === 'pending' ? "Verifikasyon an kous..." : "KYC Obligatwa"}

                  </p>

                  <button

                    onClick={() => router.push('/kyc')}

                    className="bg-white text-black px-10 py-4 rounded-full font-black text-[11px] uppercase shadow-2xl active:scale-90 transition-all"

                  >

                    Aktive Kat

                  </button>

                </div>

              )}
              <div

                className={`relative h-full w-full transition-all duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}

                onClick={() => isActivated && setIsFlipped(!isFlipped)}

              >

                {/* DEVAN */}

                <div className="absolute inset-0 backface-hidden rounded-[2.5rem] overflow-hidden bg-gradient-to-tr from-red-700 via-red-600 to-zinc-950 p-8 shadow-2xl border border-white/5">

                    <div className={`flex flex-col h-full justify-between transition-all duration-500 ${!isActivated ? 'blur-md opacity-40 select-none' : ''}`}>

                        <div className="flex justify-between items-start">

                          <div className="w-12 h-12 bg-white/10 rounded-xl border border-white/20 flex items-center justify-center overflow-hidden backdrop-blur-sm">

                             {isActivated && <img src="https://i.imgur.com/xDk58Xk.png" alt="Logo" className="w-full h-full object-cover" />}

                          </div>

                          <h2 className="text-[14px] font-black italic tracking-tighter text-white uppercase font-mono">Hatex Premium</h2>

                        </div>
                        <div className="space-y-4 text-white">

                          <p className="text-2xl font-mono font-bold tracking-[0.25em]">

                            {formatCardNumber(userData?.card_number)}

                          </p>

                          <div className="flex justify-between items-end">

                            <div>

                               <p className="text-[8px] opacity-60 uppercase font-black mb-1">Non Pwopriyetè</p>

                               <p className="text-[11px] font-black uppercase italic tracking-widest text-white">{userData?.full_name}</p>

                            </div>

                            <div className="flex gap-4 text-right">

                               <div>

                                  <p className="text-[8px] opacity-60 uppercase font-black mb-1 italic">Exp</p>

                                  <p className="text-[10px] font-bold">{isActivated ? userData?.exp_date : "**/**"}</p>

                               </div>

                               <div>

                                  <p className="text-[8px] opacity-60 uppercase font-black mb-1 italic">CVV</p>

                                  <p className="text-[10px] font-bold">{showNumbers ? userData?.cvv : "***"}</p>

                               </div>

                            </div>

                          </div>

                        </div>

                    </div>

                </div>
                {/* DÈYÈ */}

                <div className="absolute inset-0 rotate-y-180 backface-hidden rounded-[2.5rem] bg-zinc-900 p-8 border border-white/10 flex flex-col items-center justify-center shadow-2xl">

                    <div className="w-full h-12 bg-black absolute top-8 left-0"></div>

                    <div className="mt-10 bg-white p-2 rounded-2xl">

                       <QRCodeSVG value={`Card:${userData?.card_number}|Owner:${userData?.full_name}`} size={110} level="H" />

                    </div>

                    <p className="text-[9px] font-black uppercase mt-5 text-red-600 tracking-widest italic animate-pulse">Scan pou peye</p>

                </div>

              </div>

            </div>

        </div>
        {/* 5. DÈNYE AKTIVITE */}

        <div className="mb-32">

            <div className="flex justify-between items-center mb-5 px-2">

              <p className="text-[11px] font-black uppercase italic text-zinc-500 tracking-widest">Dènye Aktivite</p>

              <button onClick={() => router.push('/transactions')} className="text-[10px] font-bold text-red-500 uppercase italic">Wè tout</button>

            </div>

            <div className="space-y-3">

               {/* N ap ka fè yon "map" tranzaksyon yo isit la apre sa */}

               <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-[1.8rem] text-center backdrop-blur-md">

                  <p className="text-[9px] font-black uppercase text-zinc-600 italic">Pa gen tranzaksyon ankò</p>

               </div>

            </div>

        </div>

        {/* 6. NAVIGASYON ANBA */}

        <div className="fixed bottom-6 left-6 right-6 bg-zinc-900/80 backdrop-blur-xl border border-white/5 h-20 rounded-[2.5rem] flex justify-between items-center px-8 z-50 shadow-2xl">

          <div className="flex flex-col items-center gap-1 text-red-600">

              <div className="w-1.5 h-1.5 bg-red-600 rounded-full mb-1"></div>

              <span className="text-[10px] font-black uppercase tracking-tighter">Akey</span>

          </div>

          <div

  onClick={() => router.push('/kat')}

  className="flex flex-col items-center gap-1 cursor-pointer text-white hover:opacity-100 transition-opacity"

>

  {/* Ou ka ajoute yon icon isit la si w vle */}

  <span className="text-[10px] font-black uppercase tracking-tighter">Kat</span>

</div>

          <div onClick={() => router.push('/terminal')} className="relative -mt-14 cursor-pointer">

            <div className="bg-red-600 w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-red-600/40 rotate-45">

                <span className="text-2xl font-black -rotate-45 text-white">T</span>

            </div>

          </div>

          <div onClick={() => router.push('/transactions')} className="flex flex-col items-center gap-1 opacity-40 cursor-pointer text-white">

            <span className="text-[10px] font-black uppercase tracking-tighter">Istorik</span>

          </div>

          <div onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }} className="flex flex-col items-center gap-1 opacity-40 cursor-pointer text-red-400">

            <span className="text-[10px] font-black uppercase tracking-tighter">Soti</span>

          </div>

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