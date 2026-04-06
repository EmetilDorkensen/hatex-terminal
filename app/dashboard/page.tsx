"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { createBrowserClient } from '@supabase/ssr';

export default function Dashboard() {
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
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

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
            setUserData({ ...profile, email: user.email });
            setIsActivated(profile.kyc_status === 'approved');
          }

          const { data: transactions } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .not('description', 'ilike', '%Voye bay%')
            .order('created_at', { ascending: false })
            .limit(3);

          if (transactions) {
            setRecentTransactions(transactions);
          }

          const channel = supabase
            .channel(`profile_realtime_${user.id}`)
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
          setLoadingRecent(false);

          return () => { supabase.removeChannel(channel); };
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error("Erè Dashboard:", err);
        setLoading(false);
        setLoadingRecent(false);
      }
    };
    fetchUserAndProfile();
  }, [supabase, router]);

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
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans relative flex flex-col italic overflow-x-hidden">
      {/* Kontni prensipal la pral pran tout lajè a, men limite a 1200px sou gwo ekran pou li pa twò louvraj */}
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-5 md:p-6 lg:p-8 pb-32">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-red-600 p-0.5 bg-zinc-900 overflow-hidden flex items-center justify-center font-black shrink-0">
              {userData?.full_name?.charAt(0) || "H"}
            </div>
            <div className="overflow-hidden">
              <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none italic">Byenvini 👋</p>
              <h2 className="font-bold text-[11px] uppercase italic mt-1 tracking-wide truncate max-w-[120px] md:max-w-[200px] lg:max-w-[250px]">
                {userData?.full_name || "Kliyan Hatex"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {userData?.email === 'hatexcard@gmail.com' && (
              <button
                onClick={() => router.push('/admin')}
                className="bg-red-600 text-[9px] font-black px-3 py-2 rounded-lg animate-bounce"
              >
                ADMIN
              </button>
            )}
            <button
              onClick={() => setShowNumbers(!showNumbers)}
              className="w-9 h-9 bg-zinc-900/50 rounded-full border border-zinc-800 flex items-center justify-center active:scale-90 transition-all shrink-0"
            >
              <span className="text-sm">{showNumbers ? "🔒" : "👁️"}</span>
            </button>
          </div>
        </div>

        {/* Balans Wallet */}
        <div className="bg-zinc-900/30 backdrop-blur-md p-5 sm:p-6 md:p-7 rounded-[2rem] mb-6 border border-white/5 relative overflow-hidden">
          <p className="text-[11px] uppercase text-zinc-500 font-black mb-1 tracking-[0.2em]">Balans Wallet</p>
          <div className="flex items-baseline gap-2 overflow-hidden">
            <h3 className="text-4xl sm:text-5xl md:text-6xl font-black italic tracking-tighter truncate">
              {userData?.wallet_balance ? Number(userData.wallet_balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : "0.00"}
            </h3>
            <span className="text-[10px] font-bold text-red-600 uppercase italic">Goud</span>
          </div>
        </div>

        {/* Twa bouton aksyon yo */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-8">
          <button onClick={() => router.push('/deposit')} className="bg-red-600 py-4 sm:py-5 md:py-6 rounded-[2.5rem] flex items-center justify-center text-white active:scale-95 transition-all shadow-lg shadow-red-600/20">
            <span className="text-[12px] sm:text-[13px] md:text-[14px] font-black uppercase italic tracking-widest">Depo</span>
          </button>
          <button onClick={() => router.push('/withdraw')} className="bg-red-600 py-4 sm:py-5 md:py-6 rounded-[2.5rem] flex items-center justify-center text-white active:scale-95 transition-all shadow-lg shadow-red-600/20">
            <span className="text-[12px] sm:text-[13px] md:text-[14px] font-black uppercase italic tracking-widest">Retrè</span>
          </button>
          <button onClick={() => router.push('/transfert')} className="bg-white py-4 sm:py-5 md:py-6 rounded-[2.5rem] flex items-center justify-center text-red-600 shadow-xl active:scale-95 transition-all">
            <span className="text-[12px] sm:text-[13px] md:text-[14px] font-black uppercase italic tracking-widest">Transfè</span>
          </button>
        </div>

        {/* Kat Vityèl */}
        <div className="mb-10 perspective-1000">
          <p className="text-[10px] font-black uppercase italic text-zinc-500 mb-3 ml-2 tracking-widest flex justify-between">
            <span>Kat Vityèl</span>
            {isActivated && <span className="text-red-600 animate-pulse text-[8px]">Klike pou vire</span>}
          </p>
          <div className="relative aspect-[1.58/1] w-full max-w-[500px] mx-auto">
            {!isActivated && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-[2rem] bg-black/60 backdrop-blur-sm p-4 text-center">
                <p className="text-[9px] font-black uppercase mb-3 tracking-widest text-white/90">
                  {userData?.kyc_status === 'pending' ? "Verifikasyon an kous..." : "KYC Obligatwa"}
                </p>
                <button onClick={() => router.push('/kyc')} className="bg-white text-black px-8 py-3 rounded-full font-black text-[10px] uppercase shadow-2xl active:scale-90 transition-all">
                  Aktive Kat
                </button>
              </div>
            )}
            <div
              className={`relative h-full w-full transition-all duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
              onClick={() => isActivated && setIsFlipped(!isFlipped)}
            >
              {/* Devan */}
              <div className="absolute inset-0 backface-hidden rounded-[2rem] overflow-hidden bg-gradient-to-tr from-red-700 via-red-600 to-zinc-950 p-4 sm:p-5 md:p-6 shadow-2xl border border-white/5">
                <div className={`flex flex-col h-full justify-between ${!isActivated ? 'blur-md' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 bg-white/10 rounded-xl border border-white/20 flex items-center justify-center overflow-hidden">
                      {isActivated && <img src="https://i.imgur.com/xDk58Xk.png" alt="Logo" className="w-full h-full object-cover" />}
                    </div>
                    <h2 className="text-[10px] font-black italic tracking-tighter uppercase font-mono">HatexCard</h2>
                  </div>
                  <div className="space-y-3">
                    <p className="text-lg sm:text-xl md:text-2xl font-mono font-bold tracking-[0.2em] break-all">
                      {formatCardNumber(userData?.card_number)}
                    </p>
                    <div className="flex flex-wrap justify-between items-end gap-2">
                      <div className="min-w-0">
                        <p className="text-[7px] opacity-60 uppercase font-black mb-0.5">Pwopriyetè</p>
                        <p className="text-[10px] font-black uppercase truncate max-w-[150px] sm:max-w-[200px]">{userData?.full_name}</p>
                      </div>
                      <div className="flex gap-3 text-right flex-shrink-0">
                        <div>
                          <p className="text-[7px] opacity-60 uppercase font-black mb-0.5">Exp</p>
                          <p className="text-[9px] font-bold">{isActivated ? userData?.exp_date : "**/**"}</p>
                        </div>
                        <div>
                          <p className="text-[7px] opacity-60 uppercase font-black mb-0.5">CVV</p>
                          <p className="text-[9px] font-bold">{showNumbers ? userData?.cvv : "***"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Dèyè */}
              <div className="absolute inset-0 rotate-y-180 backface-hidden rounded-[2rem] bg-zinc-900 p-6 border border-white/10 flex flex-col items-center justify-center">
                <div className="w-full h-10 bg-black absolute top-6 left-0"></div>
                <div className="mt-8 bg-white p-2 rounded-xl">
                  <QRCodeSVG value={`Card:${userData?.card_number}`} size={90} />
                </div>
                <p className="text-[8px] font-black uppercase mt-4 text-red-600 tracking-widest italic animate-pulse">Eskane pou peye</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dènye Aktivite */}
        <div className="mb-20">
          <div className="flex justify-between items-center mb-4 px-2">
            <p className="text-[10px] font-black uppercase italic text-zinc-500 tracking-widest">Dènye Aktivite</p>
            <button onClick={() => router.push('/transactions')} className="text-[9px] font-bold text-red-500 uppercase italic">Wè tout</button>
          </div>

          <div className="space-y-3">
            {loadingRecent ? (
              <div className="text-center py-4"><div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
            ) : recentTransactions.length === 0 ? (
              <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[1.5rem] text-center backdrop-blur-md">
                <p className="text-[8px] font-black uppercase text-zinc-600 italic tracking-widest">Pa gen aktivite ankò</p>
              </div>
            ) : (
              recentTransactions.map((t) => (
                <div key={t.id} className="bg-zinc-900/40 border border-white/5 p-4 rounded-[2rem] backdrop-blur-md active:scale-95 transition-all">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-zinc-800/80 border border-white/5 flex-shrink-0">
                        {t.type === 'DEPOSIT' ? '📥' :
                         t.type === 'WITHDRAWAL' ? '📤' :
                         t.type === 'P2P' ? '🔄' :
                         t.type === 'CARD_RECHARGE' ? '💳' : '📄'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[10px] font-black uppercase tracking-tight text-zinc-100 truncate max-w-[120px] sm:max-w-[200px] md:max-w-[300px]">
                          {t.description}
                        </h3>
                        {t.user_email && (
                          <p className="text-[8px] text-zinc-600 font-bold lowercase truncate">
                            {t.user_email.substring(0, 3)}.....@{t.user_email.split('@')[1]}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-[12px] font-black ${t.amount > 0 ? 'text-green-500' : 'text-white'}`}>
                        {t.amount > 0 ? '+' : '-'}{Math.abs(t.amount).toLocaleString()}
                        <span className="text-[7px] ml-1">HTG</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

{/* Navigasyon anba (fixed) */}
<div className="fixed bottom-4 md:bottom-6 left-3 right-3 sm:left-4 sm:right-4 max-w-lg mx-auto bg-zinc-900/90 backdrop-blur-xl border border-white/5 h-[4.5rem] rounded-[2rem] flex justify-around sm:justify-between items-center px-4 sm:px-8 z-50 shadow-2xl">
        
        {/* Akey */}
        <div className="flex flex-col items-center text-red-600 cursor-pointer hover:scale-105 transition-all">
          <div className="w-1.5 h-1.5 bg-red-600 rounded-full mb-1"></div>
          <span className="text-[10px] sm:text-[11px] font-black uppercase">Akey</span>
        </div>

        {/* Kat */}
        <div onClick={() => router.push('/kat')} className="flex flex-col items-center opacity-50 cursor-pointer hover:opacity-100 hover:scale-105 transition-all">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-white">Kat</span>
        </div>

        {/* Bouton T (Santral) */}
        <div onClick={() => router.push('/terminal')} className="relative -mt-10 md:-mt-12 cursor-pointer hover:scale-105 transition-all">
          <div className="bg-red-600 w-14 h-14 rounded-[1.2rem] flex items-center justify-center shadow-lg shadow-red-600/40 rotate-45">
            <span className="text-2xl font-black -rotate-45 text-white italic">T</span>
          </div>
        </div>

        {/* Istorik */}
        <div onClick={() => router.push('/transactions')} className="flex flex-col items-center opacity-50 cursor-pointer hover:opacity-100 hover:scale-105 transition-all">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-white">Istorik</span>
        </div>

        {/* Paramèt */}
        <div onClick={() => router.push('/setting')} className="flex flex-col items-center opacity-50 cursor-pointer hover:opacity-100 hover:scale-105 transition-all">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-red-400">Paramèt</span>
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