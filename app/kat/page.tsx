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

          // Realtime update pou balans lan chanje sou kat la menm kote a
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

  const formatCardNumber = (num: string) => {
    if (!num) return "**** **** **** ****";
    if (!showNumbers) return `**** **** **** ${num.slice(-4)}`;
    return num.replace(/(\d{4})/g, '$1 ').trim();
  };

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
          <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none text-white/40">Premium Card</p>
          <p className={`text-[10px] font-black uppercase italic ${isActivated ? 'text-green-500' : 'text-red-600'}`}>
            {isActivated ? 'Aktif' : 'Bloke'}
          </p>
        </div>
      </div>

      {/* KAT LA */}
      <div className="mb-12 perspective-1000 relative">
        {!isActivated && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-[3rem] bg-black/80 backdrop-blur-xl p-8 text-center border border-white/5">
            <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center text-red-600 mb-6 text-2xl animate-pulse">🔒</div>
            <h3 className="text-[14px] font-black uppercase mb-2 tracking-widest">KYC Obligatwa</h3>
            <p className="text-[9px] text-zinc-500 font-bold mb-6">Verifye idantite w pou debloke kat ou a.</p>
            <button onClick={() => router.push('/kyc')} className="bg-white text-black px-12 py-5 rounded-[2rem] font-black text-[11px] uppercase shadow-2xl active:scale-95 transition-all tracking-widest">Pase KYC</button>
          </div>
        )}

        <div className={`relative aspect-[1.58/1] w-full max-w-[420px] mx-auto transition-all duration-1000 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`} onClick={() => isActivated && setIsFlipped(!isFlipped)}>
          
          {/* DEVAN (STYLE DASHBOARD) */}
          <div className="absolute inset-0 backface-hidden rounded-[2rem] overflow-hidden bg-gradient-to-tr from-red-700 via-red-600 to-zinc-950 p-6 shadow-2xl border border-white/5">
              <div className={`flex flex-col h-full justify-between ${!isActivated ? 'blur-md' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 bg-white/10 rounded-xl border border-white/20 flex items-center justify-center overflow-hidden">
                       {isActivated && <img src="https://i.imgur.com/xDk58Xk.png" alt="Logo" className="w-full h-full object-cover" />}
                    </div>
                    <div className="text-right">
                      <h2 className="text-[10px] font-black italic tracking-tighter uppercase font-mono text-white/90">HatexCard</h2>
                      {/* BALANS LAN SOU KAT LA */}
                      <p className="text-[12px] font-black italic text-white leading-none mt-1">
                        {Number(userData?.card_balance || 0).toLocaleString()} <span className="text-[7px] text-zinc-300">HTG</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-lg sm:text-xl font-mono font-bold tracking-[0.2em] text-white">
                        {formatCardNumber(userData?.card_number)}
                      </p>
                      <button onClick={(e) => { e.stopPropagation(); setShowNumbers(!showNumbers); }} className="text-[10px] opacity-50">{showNumbers ? "🔒" : "👁️"}</button>
                    </div>

                    <div className="flex justify-between items-end">
                      <div>
                         <p className="text-[7px] opacity-60 uppercase font-black mb-0.5">Pwopriyetè</p>
                         <p className="text-[10px] font-black uppercase truncate max-w-[150px]">{userData?.full_name}</p>
                      </div>
                      <div className="flex gap-3 text-right">
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

{/* DÈYÈ */}
<div className="absolute inset-0 rotate-y-180 backface-hidden rounded-[2rem] bg-[#0d0e14] p-8 border border-white/10 flex flex-col items-center justify-between shadow-2xl shadow-red-900/10">
              <div className="w-full h-12 bg-black absolute top-8 left-0 border-y border-white/5"></div>
              <div className="mt-20 bg-white p-2 rounded-2xl">
                 <QRCodeSVG value={`Card:${userData?.card_number}`} size={100} />
              </div>
              <p className="text-[7px] font-black uppercase text-red-600 tracking-[0.4em] italic">Hatex Secure Protocol</p>
          </div>
        </div>
      </div>

      {/* AKSYON YO */}
      {isActivated && (
        <div className="space-y-4 animate-in slide-in-from-bottom-10 duration-700">
           <div className="grid grid-cols-2 gap-3">
             <button onClick={() => handleCopy(userData?.card_number, "Nimewo")} className="bg-zinc-900/50 border border-white/5 p-5 rounded-[2rem] text-[9px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all">Kopye Nimewo</button>
             <button onClick={() => handleCopy(userData?.cvv, "CVV")} className="bg-zinc-900/50 border border-white/5 p-5 rounded-[2rem] text-[9px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all">Kopye CVV</button>
           </div>
           
           <div className="bg-gradient-to-r from-red-600 to-red-800 p-1 rounded-[2.5rem]">
             <button 
               onClick={() => router.push('/kat/recharge')}
               className="w-full bg-[#0a0b14] py-6 rounded-[2.4rem] font-black uppercase italic text-[12px] tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-3"
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