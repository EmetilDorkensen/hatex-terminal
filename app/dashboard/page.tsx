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

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Jwenn itilizatè a
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.replace('/login');
          return;
        }

        // 2. Rale pwofil la
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUserData({ ...profile, email: user.email });
          setIsActivated(profile.kyc_status === 'approved');
        }
      } catch (err) {
        console.error("Erè:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // 3. LISTEN REALTIME - Sa ap fè kòb la moute san refresh
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles' 
      }, (payload) => {
        setUserData((prev: any) => ({ ...prev, ...payload.new }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, router]);

  const formatCardNumber = (num: string) => {
    if (!num) return "**** **** **** ****";
    if (showNumbers) return num.match(/.{1,4}/g)?.join(' ');
    return `${num.substring(0, 4)} **** **** ${num.substring(12, 16)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white text-[10px] font-black uppercase italic tracking-widest animate-pulse">Chaje Done yo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans relative flex flex-col italic overflow-x-hidden selection:bg-red-600/30">
      
      {/* GLOW DECORATION */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-600/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md mx-auto p-6 pb-32 z-10">
        
        {/* 1. HEADER PERSONNALISÉ */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl border-2 border-red-600/50 p-0.5 bg-gradient-to-br from-zinc-800 to-black overflow-hidden flex items-center justify-center shadow-lg shadow-red-600/20">
                <span className="text-lg font-black text-white">{userData?.full_name?.charAt(0) || "H"}</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-[#0a0b14] rounded-full"></div>
            </div>
            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.2em] leading-none mb-1">Status: Aktif</p>
              <h2 className="font-black text-xs uppercase tracking-tight truncate max-w-[150px]">
                {userData?.full_name || "Itilizatè Hatex"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {userData?.email === 'hatexcard@gmail.com' && (
              <button onClick={() => router.push('/admin')} className="bg-red-600 text-white text-[8px] font-black px-4 py-2 rounded-xl shadow-lg shadow-red-600/40 border border-white/10 animate-pulse uppercase">Admin</button>
            )}
            <button onClick={() => setShowNumbers(!showNumbers)} className="w-10 h-10 bg-zinc-900/80 rounded-2xl border border-white/5 flex items-center justify-center backdrop-blur-md active:scale-90 transition-all">
              <span className="text-lg">{showNumbers ? "🔒" : "👁️"}</span>
            </button>
          </div>
        </div>

        {/* 2. BALANS WALLET - SA A AP MOUTE SÈLMAN SI DONE A NAN SUPABASE */}
        <div className="bg-gradient-to-br from-zinc-900/80 to-black p-7 rounded-[2.5rem] mb-8 border border-white/5 relative overflow-hidden shadow-2xl group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>
          </div>
          <p className="text-[10px] uppercase text-zinc-500 font-black mb-2 tracking-[0.3em]">Balans Disponib</p>
          <div className="flex items-baseline gap-3">
            <h3 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500">
              {userData?.wallet_balance ? Number(userData.wallet_balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : "0.00"}
            </h3>
            <span className="text-[10px] font-black text-red-600 uppercase italic bg-red-600/10 px-2 py-1 rounded-md">Goud</span>
          </div>
        </div>

        {/* 3. AKSYON RAPID */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          <button onClick={() => router.push('/deposit')} className="group flex flex-col items-center gap-3">
            <div className="w-full aspect-square bg-red-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-red-600/20 group-active:scale-90 transition-all">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Depo</span>
          </button>
          <button onClick={() => router.push('/withdraw')} className="group flex flex-col items-center gap-3">
            <div className="w-full aspect-square bg-zinc-900 border border-white/5 rounded-[2rem] flex items-center justify-center group-active:scale-90 transition-all">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Retrè</span>
          </button>
          <button onClick={() => router.push('/transfert')} className="group flex flex-col items-center gap-3">
            <div className="w-full aspect-square bg-white rounded-[2rem] flex items-center justify-center group-active:scale-90 transition-all">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 10l4 4-4 4M7 14l-4-4 4-4M3 10h18"/></svg>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 text-white">Transfè</span>
          </button>
        </div>

        {/* 4. KAT VITYÈL LA */}
        <div className="perspective-1000 mb-12">
          <div 
            className={`relative aspect-[1.58/1] w-full transition-all duration-[800ms] preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
            onClick={() => isActivated && setIsFlipped(!isFlipped)}
          >
            {/* FRONT */}
            <div className="absolute inset-0 backface-hidden rounded-[2.5rem] bg-gradient-to-tr from-red-800 via-red-600 to-zinc-950 p-8 shadow-2xl border border-white/10 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
              
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center">
                  <div className="w-8 h-6 bg-yellow-500/80 rounded-sm shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-black/20 mt-1"></div>
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-black/20 mt-3"></div>
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-black/20 mt-5"></div>
                  </div>
                </div>
                <h2 className="text-[12px] font-black italic tracking-tighter uppercase text-white/90">HatexCard <span className="text-black/40">Premium</span></h2>
              </div>

              <div className="space-y-4">
                <p className="text-2xl font-mono font-bold tracking-[0.25em] text-white drop-shadow-lg">
                  {formatCardNumber(userData?.card_number)}
                </p>
                <div className="flex justify-between items-end">
                  <div className="max-w-[180px]">
                    <p className="text-[7px] opacity-60 uppercase font-black mb-1">Kat Pwopriyetè</p>
                    <p className="text-[11px] font-black uppercase truncate tracking-widest italic">{userData?.full_name}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-right">
                      <p className="text-[7px] opacity-60 uppercase font-black mb-1">Expire</p>
                      <p className="text-[10px] font-bold font-mono">{isActivated ? userData?.exp_date : "**/**"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[7px] opacity-60 uppercase font-black mb-1">CVV</p>
                      <p className="text-[10px] font-bold font-mono">{showNumbers ? userData?.cvv : "***"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BACK */}
            <div className="absolute inset-0 rotate-y-180 backface-hidden rounded-[2.5rem] bg-[#0a0b14] border border-white/10 p-8 flex flex-col items-center justify-center shadow-2xl">
              <div className="w-full h-12 bg-zinc-800 absolute top-8 left-0"></div>
              <div className="bg-white p-3 rounded-[1.5rem] shadow-2xl mt-4">
                <QRCodeSVG value={`Card:${userData?.card_number}`} size={100} />
              </div>
              <p className="text-[9px] font-black uppercase mt-6 text-red-600 tracking-[0.3em] animate-pulse">Eskane pou peye</p>
            </div>
          </div>
          
          {!isActivated && (
            <div className="mt-6 bg-red-600/10 border border-red-600/20 p-4 rounded-2xl flex items-center justify-between">
              <p className="text-[9px] font-black uppercase text-red-500 italic">Kat la pa aktif</p>
              <button onClick={() => router.push('/kyc')} className="bg-red-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">Aktive Kounye a</button>
            </div>
          )}
        </div>

      </div>

      {/* NAVBAR FIXE */}
      <div className="fixed bottom-6 left-6 right-6 max-w-md mx-auto bg-zinc-900/80 backdrop-blur-2xl border border-white/10 h-20 rounded-[2.5rem] flex justify-between items-center px-10 z-50 shadow-2xl shadow-black">
        <div className="flex flex-col items-center text-red-600">
          <div className="w-1.5 h-1.5 bg-red-600 rounded-full mb-1"></div>
          <span className="text-[9px] font-black uppercase tracking-tighter">Akey</span>
        </div>
        <div onClick={() => router.push('/kat')} className="flex flex-col items-center opacity-30 hover:opacity-100 transition-all cursor-pointer">
          <span className="text-[9px] font-black uppercase tracking-tighter">Kat</span>
        </div>
        <div onClick={() => router.push('/terminal')} className="relative -mt-14">
          <div className="bg-red-600 w-16 h-16 rounded-[1.8rem] flex items-center justify-center shadow-2xl shadow-red-600/40 rotate-45 active:scale-90 transition-all hover:bg-red-500 border-4 border-[#0a0b14]">
            <span className="text-2xl font-black -rotate-45 text-white italic">T</span>
          </div>
        </div>
        <div onClick={() => router.push('/transactions')} className="flex flex-col items-center opacity-30 hover:opacity-100 transition-all cursor-pointer">
          <span className="text-[9px] font-black uppercase tracking-tighter">Istorik</span>
        </div>
        <div onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="flex flex-col items-center opacity-30 hover:opacity-100 transition-all cursor-pointer">
          <span className="text-[9px] font-black uppercase tracking-tighter text-red-400">Soti</span>
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