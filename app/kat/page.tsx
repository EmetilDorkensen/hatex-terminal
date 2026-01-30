"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { QRCodeSVG } from 'qrcode.react';

export default function KatPage() {
  const router = useRouter();
  const [copyStatus, setCopyStatus] = useState("");
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profile) setUserData({ ...profile, email: user.email });

          // LISTEN REALTIME: Si balans kat la chanje, l ap update otomatik
          supabase
            .channel(`card_update_${user.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, 
              (payload) => setUserData((prev: any) => ({ ...prev, ...payload.new })))
            .subscribe();
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserAndProfile();
  }, [supabase, router]);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyStatus(`${label} kopye!`);
    setTimeout(() => setCopyStatus(""), 2000);
  };

  const isActivated = userData?.kyc_status === 'approved';

  if (loading) return (
    <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans relative flex flex-col italic overflow-x-hidden p-6 pb-32">
      
      {copyStatus && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-[0_0_30px_rgba(220,38,38,0.5)] animate-in fade-in zoom-in duration-300">
          {copyStatus} ✅
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-10">
        <button onClick={() => router.push('/dashboard')} className="w-12 h-12 bg-zinc-900/80 rounded-2xl border border-white/5 flex items-center justify-center active:scale-90 transition-all">
          <span className="text-xl italic">←</span>
        </button>
        <div className="text-right">
          <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none">Status Kat</p>
          <p className={`text-[10px] font-black uppercase italic ${isActivated ? 'text-green-500' : 'text-red-500'}`}>
            {isActivated ? 'Aktif' : 'Bloke'}
          </p>
        </div>
      </div>

      {/* BALANS KAT LA */}
      <div className="mb-10 text-center relative">
        <div className="absolute inset-0 bg-red-600/5 blur-[100px] -z-10"></div>
        <p className="text-[10px] uppercase text-zinc-500 font-black mb-2 tracking-[0.2em]">Balans Kat Vityèl</p>
        <div className="flex items-center justify-center gap-2">
           <h2 className="text-6xl font-black italic tracking-tighter">
             {Number(userData?.card_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
           </h2>
           <span className="text-[12px] font-black text-red-600 self-end mb-2">HTG</span>
        </div>
      </div>

      {/* KAT LA (UI LONG) */}
      <div className="mb-12 perspective-1000 relative">
        {!isActivated && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-[3rem] bg-black/80 backdrop-blur-xl p-8 text-center border border-white/5">
            <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center text-red-600 mb-6 text-2xl animate-pulse">🔒</div>
            <h3 className="text-[14px] font-black uppercase mb-2 tracking-widest">KYC Obligatwa</h3>
            <p className="text-[9px] text-zinc-500 font-bold mb-6 leading-relaxed">Pou sekirite ak konfòmite, ou dwe verifye idantite w anvan w gen aksè ak enfòmasyon kat la.</p>
            <button onClick={() => router.push('/kyc')} className="bg-white text-black px-12 py-5 rounded-[2rem] font-black text-[11px] uppercase shadow-2xl active:scale-95 transition-all">Pase KYC Kounye a</button>
          </div>
        )}

        <div className={`relative aspect-[1.58/1] w-full max-w-[420px] mx-auto transition-all duration-1000 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`} onClick={() => isActivated && setIsFlipped(!isFlipped)}>
          {/* DEVAN */}
          <div className="absolute inset-0 backface-hidden rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950 p-8 shadow-2xl border border-white/10 shadow-red-900/20">
              <div className={`flex flex-col h-full justify-between ${!isActivated ? 'blur-2xl' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="w-14 h-14 bg-gradient-to-br from-white/20 to-transparent rounded-2xl border border-white/20 flex items-center justify-center p-2 backdrop-blur-md">
                       <img src="https://i.imgur.com/xDk58Xk.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-black italic tracking-widest text-zinc-100">HatexCard</p>
                      <p className="text-[7px] font-black uppercase text-red-600 opacity-80">Virtual Platinum</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between bg-black/20 p-3 rounded-2xl border border-white/5 backdrop-blur-sm">
                      <p className="text-xl sm:text-2xl font-mono font-bold tracking-[0.2em] text-zinc-100">
                        {showNumbers ? userData?.card_number : `**** **** **** ${userData?.card_number?.slice(-4)}`}
                      </p>
                      <button onClick={(e) => { e.stopPropagation(); setShowNumbers(!showNumbers); }} className="w-10 h-10 flex items-center justify-center text-lg">{showNumbers ? "🔒" : "👁️"}</button>
                    </div>

                    <div className="flex justify-between items-end">
                      <div className="flex-1">
                         <p className="text-[7px] opacity-40 uppercase font-black mb-1">Card Holder</p>
                         <p className="text-[12px] font-black uppercase tracking-wide truncate">{userData?.full_name}</p>
                      </div>
                      <div className="flex gap-6">
                         <div className="text-center" onClick={(e) => { e.stopPropagation(); handleCopy(userData?.exp_date, "EXP"); }}>
                            <p className="text-[7px] opacity-40 uppercase font-black mb-1">Expires</p>
                            <p className="text-[10px] font-bold">{isActivated ? userData?.exp_date : "**/**"}</p>
                         </div>
                         <div className="text-center" onClick={(e) => { e.stopPropagation(); handleCopy(userData?.cvv, "CVV"); }}>
                            <p className="text-[7px] opacity-40 uppercase font-black mb-1">CVV</p>
                            <p className="text-[10px] font-bold">{showNumbers ? userData?.cvv : "***"}</p>
                         </div>
                      </div>
                    </div>
                  </div>
              </div>
          </div>
          {/* DÈYÈ */}
          <div className="absolute inset-0 rotate-y-180 backface-hidden rounded-[2.5rem] bg-[#0d0e14] p-8 border border-white/10 flex flex-col items-center justify-between shadow-2xl">
              <div className="w-full h-14 bg-zinc-950 absolute top-10 left-0 border-y border-white/5"></div>
              <div className="mt-24 bg-white p-3 rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                 <QRCodeSVG value={`Card:${userData?.card_number}`} size={120} />
              </div>
              <p className="text-[9px] font-black uppercase text-red-600 tracking-[0.5em] animate-pulse">Sistèm Sekirize</p>
          </div>
        </div>
      </div>

      {/* AKSYON YO */}
      {isActivated && (
        <div className="space-y-4 animate-in slide-in-from-bottom-10 duration-700">
           <div className="grid grid-cols-2 gap-3">
             <button onClick={() => handleCopy(userData?.card_number, "Nimewo")} className="bg-zinc-900/50 border border-white/5 p-5 rounded-[2rem] text-[10px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"><span>📋</span> Kopye Nimewo</button>
             <button onClick={() => handleCopy(userData?.cvv, "CVV")} className="bg-zinc-900/50 border border-white/5 p-5 rounded-[2rem] text-[10px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"><span>📋</span> Kopye CVV</button>
           </div>
           
           <div className="bg-gradient-to-r from-red-600 to-red-800 p-1 rounded-[2.5rem]">
             <button 
               onClick={() => router.push('/kat/recharge')}
               className="w-full bg-[#0a0b14] py-6 rounded-[2.4rem] font-black uppercase italic text-[13px] tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-3"
             >
               <span>💳</span> Rechaje Kat la (0 Fre)
             </button>
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