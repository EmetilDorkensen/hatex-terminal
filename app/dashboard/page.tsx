"use client";
import React, { useState, useEffect, useCallback } from 'react';
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
  const [error, setError] = useState<string | null>(null);

  // Fonksyon pou rale done yo (separe pou nou ka rele l nenpòt lè)
  const fetchUserAndProfile = useCallback(async () => {
    try {
      // 1. Verifye itilizatè a
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log("Pa gen itilizatè, redireksyon...");
        router.push('/login');
        return;
      }

      // 2. Rale pwofil la ak wallet_balance
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profileError) throw profileError;

      if (profile) {
        setUserData({ ...profile, email: user.email });
        setIsActivated(profile.kyc_status === 'approved');
      }

      // 3. Koute chanjman an tan reyèl (Realtime)
      const channel = supabase
        .channel(`realtime_dashboard_${user.id}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${user.id}` 
        }, (payload) => {
            console.log("Balans ajou!");
            setUserData((prev: any) => ({ ...prev, ...payload.new }));
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };

    } catch (err: any) {
      console.error("Erè bò Dashboard:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    fetchUserAndProfile();
  }, [fetchUserAndProfile]);

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

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0b14] flex flex-col items-center justify-center text-white p-5 text-center">
        <p className="text-red-500 mb-4 font-bold uppercase tracking-widest text-xs italic">Gen yon erè: {error}</p>
        <button onClick={() => window.location.reload()} className="bg-white text-black px-6 py-2 rounded-full font-black text-[10px] uppercase italic tracking-widest active:scale-95 transition-all shadow-xl">Eseye ankò</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans relative flex flex-col italic overflow-x-hidden">
      
      {/* 1. HEADER */}
      <div className="w-full max-w-md mx-auto p-5 pb-0">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-red-600 p-0.5 bg-zinc-900 overflow-hidden flex items-center justify-center font-black shrink-0 shadow-lg shadow-red-600/10">
                {userData?.full_name?.charAt(0) || "H"}
            </div>
            <div className="overflow-hidden">
              <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none italic">Byenvini 👋</p>
              <h2 className="font-bold text-[11px] uppercase italic mt-1 tracking-wide truncate max-w-[120px]">
                {userData?.full_name || "Kliyan Hatex"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {userData?.email === 'hatexcard@gmail.com' && (
              <button 
                onClick={() => router.push('/admin')}
                className="bg-red-600 text-[9px] font-black px-3 py-2 rounded-lg animate-bounce border border-white/10 shadow-lg shadow-red-600/30"
              >
                ADMIN
              </button>
            )}
            
            <button
              onClick={() => setShowNumbers(!showNumbers)}
              className="w-9 h-9 bg-zinc-900/50 rounded-full border border-zinc-800 flex items-center justify-center active:scale-90 transition-all shrink-0 hover:border-red-600/50"
            >
              <span className="text-sm">{showNumbers ? "🔒" : "👁️"}</span>
            </button>
          </div>
        </div>

        {/* 2. BALANS WALLET */}
        <div className="bg-zinc-900/30 backdrop-blur-md p-5 rounded-[2.5rem] mb-6 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <p className="text-[11px] uppercase text-zinc-500 font-black mb-1 tracking-[0.2em]">Balans Wallet</p>
          <div className="flex items-baseline gap-2 overflow-hidden">
            <h3 className="text-4xl sm:text-5xl font-black italic tracking-tighter truncate">
              {userData?.wallet_balance ? Number(userData.wallet_balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : "0.00"}
            </h3>
            <span className="text-[10px] font-bold text-red-600 uppercase italic">Goud</span>
          </div>
        </div>

        {/* 3. BOUTON AKSYON YO */}
        <div className="grid grid-cols-3 gap-2 mb-8">
          <button onClick={() => router.push('/deposit')} className="bg-red-600 py-6 rounded-[2.5rem] flex items-center justify-center text-white active:scale-95 transition-all shadow-lg shadow-red-600/20 hover:bg-red-700">
            <span className="text-[12px] font-black uppercase italic tracking-widest">Depo</span>
          </button>
          <button onClick={() => router.push('/withdraw')} className="bg-red-600 py-6 rounded-[2.5rem] flex items-center justify-center text-white active:scale-95 transition-all shadow-lg shadow-red-600/20 hover:bg-red-700">
            <span className="text-[12px] font-black uppercase italic tracking-widest">Retrè</span>
          </button>
          <button onClick={() => router.push('/transfert')} className="bg-white py-6 rounded-[2.5rem] flex items-center justify-center text-red-600 shadow-xl active:scale-95 transition-all hover:bg-zinc-100">
            <span className="text-[12px] font-black uppercase italic tracking-widest">Transfè</span>
          </button>
        </div>

        {/* 4. KAT VITYÈL */}
        <div className="mb-10 perspective-1000">
            <div className="flex justify-between items-center mb-3 px-2">
               <p className="text-[10px] font-black uppercase italic text-zinc-500 tracking-widest">Kat Vityèl</p>
               {isActivated && <span className="text-red-600 animate-pulse text-[8px] font-black uppercase italic">Klike pou vire</span>}
            </div>
            <div className="relative aspect-[1.58/1] w-full max-w-[400px] mx-auto">
              {!isActivated && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-[2.5rem] bg-black/70 backdrop-blur-md p-4 text-center border border-white/5">
                  <p className="text-[9px] font-black uppercase mb-3 tracking-widest text-white/90">
                    {userData?.kyc_status === 'pending' ? "Verifikasyon ap fèt..." : "KYC Obligatwa pou kat"}
                  </p>
                  <button onClick={() => router.push('/kyc')} className="bg-white text-black px-8 py-3 rounded-full font-black text-[10px] uppercase shadow-2xl active:scale-90 transition-all italic tracking-widest">
                    Aktive Kat
                  </button>
                </div>
              )}
              <div
                className={`relative h-full w-full transition-all duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''} shadow-2xl shadow-red-600/10`}
                onClick={() => isActivated && setIsFlipped(!isFlipped)}
              >
                {/* DEVAN */}
                <div className="absolute inset-0 backface-hidden rounded-[2.5rem] overflow-hidden bg-gradient-to-tr from-red-700 via-red-600 to-zinc-950 p-6 border border-white/10">
                    <div className={`flex flex-col h-full justify-between ${!isActivated ? 'blur-lg' : ''}`}>
                        <div className="flex justify-between items-start">
                          <div className="w-10 h-10 bg-white/10 rounded-xl border border-white/20 flex items-center justify-center overflow-hidden">
                             {isActivated && <img src="https://i.imgur.com/xDk58Xk.png" alt="Logo" className="w-full h-full object-cover" />}
                          </div>
                          <h2 className="text-[10px] font-black italic tracking-tighter uppercase font-mono text-white/80">HatexCard</h2>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xl sm:text-2xl font-mono font-bold tracking-[0.2em] text-white drop-shadow-md">
                            {formatCardNumber(userData?.card_number)}
                          </p>
                          <div className="flex justify-between items-end">
                            <div>
                               <p className="text-[7px] opacity-60 uppercase font-black mb-0.5 tracking-tighter">Pwopriyetè</p>
                               <p className="text-[10px] font-black uppercase truncate max-w-[150px] italic">{userData?.full_name}</p>
                            </div>
                            <div className="flex gap-4 text-right">
                               <div>
                                  <p className="text-[7px] opacity-60 uppercase font-black mb-0.5 tracking-tighter">Exp</p>
                                  <p className="text-[9px] font-bold font-mono">{isActivated ? userData?.exp_date : "**/**"}</p>
                               </div>
                               <div>
                                  <p className="text-[7px] opacity-60 uppercase font-black mb-0.5 tracking-tighter">CVV</p>
                                  <p className="text-[9px] font-bold font-mono">{showNumbers ? userData?.cvv : "***"}</p>
                               </div>
                            </div>
                          </div>
                        </div>
                    </div>
                </div>
                {/* DÈYÈ */}
                <div className="absolute inset-0 rotate-y-180 backface-hidden rounded-[2.5rem] bg-zinc-900 p-6 border border-white/10 flex flex-col items-center justify-center">
                    <div className="w-full h-12 bg-black absolute top-6 left-0"></div>
                    <div className="mt-8 bg-white p-2 rounded-xl shadow-inner">
                       <QRCodeSVG value={`Card:${userData?.card_number}`} size={85} />
                    </div>
                    <p className="text-[8px] font-black uppercase mt-4 text-red-600 tracking-widest italic animate-pulse">Eskane pou peye</p>
                </div>
              </div>
            </div>
        </div>

        {/* 5. DÈNYE AKTIVITE */}
        <div className="mb-32">
            <div className="flex justify-between items-center mb-4 px-2">
              <p className="text-[10px] font-black uppercase italic text-zinc-500 tracking-widest">Dènye Aktivite</p>
              <button onClick={() => router.push('/transactions')} className="text-[9px] font-bold text-red-500 uppercase italic hover:scale-105 transition-all">Wè tout</button>
            </div>
            <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-[2rem] text-center backdrop-blur-md">
                <p className="text-[8px] font-black uppercase text-zinc-600 italic tracking-widest">Pa gen tranzaksyon resan</p>
            </div>
        </div>

        {/* 6. NAVIGASYON ANBA */}
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-zinc-900/90 backdrop-blur-2xl border border-white/5 h-18 rounded-[2.5rem] flex justify-between items-center px-8 z-50 shadow-2xl">
          <div className="flex flex-col items-center text-red-600 scale-110">
              <div className="w-1 h-1 bg-red-600 rounded-full mb-1"></div>
              <span className="text-[8px] font-black uppercase italic tracking-tighter">Akey</span>
          </div>
          <div onClick={() => router.push('/kat')} className="flex flex-col items-center opacity-40 hover:opacity-100 transition-all cursor-pointer">
            <span className="text-[8px] font-black uppercase text-white italic tracking-tighter">Kat</span>
          </div>
          <div onClick={() => router.push('/terminal')} className="relative -mt-12">
            <div className="bg-red-600 w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-red-600/40 rotate-45 active:scale-90 transition-all hover:bg-red-500">
                <span className="text-2xl font-black -rotate-45 text-white italic">T</span>
            </div>
          </div>
          <div onClick={() => router.push('/transactions')} className="flex flex-col items-center opacity-40 hover:opacity-100 transition-all cursor-pointer">
            <span className="text-[8px] font-black uppercase text-white italic tracking-tighter">Istorik</span>
          </div>
          <div onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }} className="flex flex-col items-center opacity-40 hover:opacity-100 transition-all cursor-pointer">
            <span className="text-[8px] font-black uppercase text-red-400 italic tracking-tighter">Soti</span>
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