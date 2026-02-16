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
          // 1. Rale done pwofil la
          let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profile) {
            setUserData({ ...profile, email: user.email });
            setIsActivated(profile.kyc_status === 'approved');
          }
  
          // 2. Rale 3 dènye aktivite yo
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
          // 3. LISTEN REALTIME
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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-500/30 pb-24 relative overflow-hidden">
      
      {/* BACKGROUND ACCENTS (Glow Effects) */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none"></div>

      {/* CONTENU PRINCIPAL */}
      <div className="w-full max-w-lg mx-auto p-6 relative z-10">
        
        {/* 1. HEADER MODÈN */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center font-black text-lg shadow-xl">
                    {userData?.full_name?.charAt(0) || "H"}
                </div>
                {/* Status indicator dot */}
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#050505] ${isActivated ? 'bg-green-500' : 'bg-orange-500'}`}></div>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Byenvini,</p>
              <h2 className="font-bold text-lg leading-none truncate max-w-[150px]">
                {userData?.full_name?.split(' ')[0] || "Kliyan"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {userData?.email === 'hatexcard@gmail.com' && (
              <button 
                onClick={() => router.push('/admin')}
                className="bg-red-600/20 text-red-500 border border-red-600/30 text-[9px] font-black px-3 py-1.5 rounded-full hover:bg-red-600 hover:text-white transition-all"
              >
                ADMIN
              </button>
            )}
            
            <button
              onClick={() => setShowNumbers(!showNumbers)}
              className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 flex items-center justify-center transition-all backdrop-blur-md"
            >
              <span className="text-lg opacity-70">{showNumbers ? "🔒" : "👁️"}</span>
            </button>
          </div>
        </div>

        {/* 2. BALANS WALLET (Glass Card) */}
        <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/5 backdrop-blur-xl p-6 rounded-[2rem] mb-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
          </div>
          
          <p className="text-[10px] uppercase text-zinc-500 font-black mb-2 tracking-[0.2em]">Balans Disponib</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl sm:text-5xl font-bold tracking-tighter text-white">
              {userData?.wallet_balance ? Number(userData.wallet_balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : "0.00"}
            </h3>
            <span className="text-xs font-black text-red-500 bg-red-500/10 px-2 py-1 rounded-md">HTG</span>
          </div>
        </div>

        {/* 3. AKSYON RAPID (Grid Layout) */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <button onClick={() => router.push('/deposit')} className="group flex flex-col items-center gap-2">
            <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-[1.5rem] flex items-center justify-center text-2xl group-active:scale-95 transition-all shadow-lg group-hover:border-green-500/30 group-hover:bg-green-500/5">
                <span className="group-hover:scale-110 transition-transform">📥</span>
            </div>
            <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Depo</span>
          </button>
          
          <button onClick={() => router.push('/withdraw')} className="group flex flex-col items-center gap-2">
            <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-[1.5rem] flex items-center justify-center text-2xl group-active:scale-95 transition-all shadow-lg group-hover:border-red-500/30 group-hover:bg-red-500/5">
                <span className="group-hover:scale-110 transition-transform">📤</span>
            </div>
            <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Retrè</span>
          </button>

          <button onClick={() => router.push('/transfert')} className="group flex flex-col items-center gap-2">
            <div className="w-16 h-16 bg-white text-black border border-white rounded-[1.5rem] flex items-center justify-center text-2xl group-active:scale-95 transition-all shadow-lg shadow-white/10">
                <span className="group-hover:rotate-45 transition-transform">🚀</span>
            </div>
            <span className="text-[10px] font-bold uppercase text-white tracking-wider">Transfè</span>
          </button>
        </div>

        {/* 4. KAT VITYÈL (Premium Look) */}
        <div className="mb-12 perspective-1000">
            <div className="flex justify-between items-end mb-4 px-2">
                <p className="text-xs font-bold uppercase text-zinc-500 tracking-widest">Kat Hatex ou</p>
                {isActivated && <span className="text-[9px] text-red-500 font-bold animate-pulse bg-red-500/10 px-2 py-1 rounded">Touche pou vire</span>}
            </div>
            
            <div className="relative aspect-[1.586/1] w-full max-w-[380px] mx-auto group">
              {!isActivated && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-3xl bg-black/80 backdrop-blur-sm border border-white/10 p-6 text-center">
                  <div className="w-12 h-12 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center mb-3">⚠️</div>
                  <p className="text-[10px] font-bold uppercase mb-4 tracking-widest text-zinc-300">
                    {userData?.kyc_status === 'pending' ? "Verifikasyon an kous..." : "Aksyon Rekiz"}
                  </p>
                  <button onClick={() => router.push('/kyc')} className="bg-white text-black px-6 py-3 rounded-xl font-bold text-xs uppercase shadow-xl hover:bg-zinc-200 transition-colors">
                    Aktive Kounye a
                  </button>
                </div>
              )}
              
              <div
                className={`relative h-full w-full transition-all duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''} ${!isActivated ? 'scale-[0.98] opacity-50' : ''}`}
                onClick={() => isActivated && setIsFlipped(!isFlipped)}
              >
                {/* DEVAN - Premium Gradient */}
                <div className="absolute inset-0 backface-hidden rounded-3xl overflow-hidden bg-gradient-to-br from-[#1a1a1a] via-[#0a0a0a] to-black border border-white/10 shadow-2xl">
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/20 blur-[50px] rounded-full"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-900/10 blur-[50px] rounded-full"></div>
                    
                    <div className="relative z-10 p-6 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-5 bg-gradient-to-r from-yellow-200 to-yellow-500 rounded flex items-center justify-center shadow-lg">
                                <div className="w-5 h-3 border border-black/20 rounded-[2px]"></div>
                             </div>
                             <span className="text-[10px] text-white/40 font-mono tracking-widest">NFC</span>
                          </div>
                          <h2 className="text-sm font-black italic tracking-tighter uppercase text-white/90">Hatex<span className="text-red-600">Card</span></h2>
                        </div>
                        
                        <div className="space-y-4">
                          <p className="text-xl sm:text-2xl font-mono font-bold tracking-[0.15em] text-zinc-100 drop-shadow-md">
                            {formatCardNumber(userData?.card_number)}
                          </p>
                          
                          <div className="flex justify-between items-end">
                            <div>
                               <p className="text-[8px] text-zinc-500 font-bold uppercase mb-1">Titulaire</p>
                               <p className="text-xs font-bold uppercase tracking-wide text-zinc-200 truncate max-w-[160px]">{userData?.full_name}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-[8px] text-zinc-500 font-bold uppercase mb-1">EXP / CVC</p>
                               <p className="text-xs font-mono font-bold text-zinc-200">
                                 {isActivated ? userData?.exp_date : "**/**"} <span className="text-zinc-600">/</span> {showNumbers ? userData?.cvv : "***"}
                               </p>
                            </div>
                          </div>
                        </div>
                    </div>
                </div>

                {/* DÈYÈ - Clean QR */}
                <div className="absolute inset-0 rotate-y-180 backface-hidden rounded-3xl bg-zinc-900 p-6 border border-white/10 flex flex-col items-center justify-center shadow-2xl">
                    <div className="w-full h-12 bg-black absolute top-8 left-0 border-y border-zinc-800"></div>
                    <div className="mt-12 bg-white p-3 rounded-2xl shadow-inner">
                       <QRCodeSVG value={`Card:${userData?.card_number}`} size={100} />
                    </div>
                    <p className="text-[9px] font-bold uppercase mt-6 text-zinc-500 tracking-[0.2em]">Scan to Pay</p>
                </div>
              </div>
            </div>
        </div>

        {/* 5. DÈNYE AKTIVITE (List Modern) */}
        <div className="mb-8">
            <div className="flex justify-between items-center mb-5 px-1">
              <p className="text-xs font-bold uppercase text-zinc-500 tracking-widest">Tranzaksyon</p>
              <button onClick={() => router.push('/transactions')} className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase tracking-wide transition-colors">Wè tout &rarr;</button>
            </div>

            <div className="space-y-3">
                {loadingRecent ? (
                    <div className="space-y-3">
                        {[1,2].map(i => <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse"></div>)}
                    </div>
                ) : recentTransactions.length === 0 ? (
                    <div className="bg-white/5 border border-white/5 border-dashed p-8 rounded-3xl text-center">
                        <p className="text-xs font-bold uppercase text-zinc-600 tracking-widest">Pa gen aktivite</p>
                    </div>
                ) : (
                    recentTransactions.map((t) => (
                        <div key={t.id} className="group bg-[#0f0f12] hover:bg-[#15151a] border border-white/5 p-4 rounded-2xl transition-all cursor-default">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${t.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {t.amount > 0 ? '↓' : '↑'}
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-bold uppercase text-zinc-200 line-clamp-1 mb-0.5">
                                            {t.description}
                                        </h3>
                                        <p className="text-[9px] text-zinc-500 font-mono">
                                           {new Date(t.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-bold tracking-tight ${t.amount > 0 ? 'text-green-500' : 'text-zinc-200'}`}>
                                        {t.amount > 0 ? '+' : ''}{Number(t.amount).toLocaleString()}
                                    </p>
                                    <p className="text-[9px] text-zinc-600 font-bold">HTG</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>

      {/* 6. NAVIGATION BAR (Floating Dock Style) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[350px] z-50">
        <div className="bg-[#121212]/90 backdrop-blur-xl border border-white/10 h-16 rounded-full flex justify-between items-center px-2 shadow-2xl shadow-black/50">
          
          <button className="flex-1 flex flex-col items-center justify-center gap-1 group">
             <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-600/30 text-white transition-all">
                <span className="text-lg">🏠</span>
             </div>
          </button>

          <button onClick={() => router.push('/kat')} className="flex-1 flex flex-col items-center justify-center gap-1 group opacity-50 hover:opacity-100 transition-opacity">
            <span className="text-xl mb-1">💳</span>
          </button>

          {/* Center Action Button */}
          <div className="relative -top-6">
             <button onClick={() => router.push('/terminal')} className="w-14 h-14 bg-white text-black rounded-2xl rotate-45 flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
                <span className="-rotate-45 text-2xl font-black">T</span>
             </button>
          </div>

          <button onClick={() => router.push('/transactions')} className="flex-1 flex flex-col items-center justify-center gap-1 group opacity-50 hover:opacity-100 transition-opacity">
            <span className="text-xl mb-1">📜</span>
          </button>

          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }} className="flex-1 flex flex-col items-center justify-center gap-1 group opacity-50 hover:opacity-100 transition-opacity text-red-500">
            <span className="text-xl mb-1">🚪</span>
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