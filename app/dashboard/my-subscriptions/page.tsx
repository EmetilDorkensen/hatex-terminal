"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2, ArrowLeft, ShieldCheck, XCircle, AlertTriangle, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MySubscriptionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchMySubscriptions() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Rale abònman yo dirèkteman nan nouvo tab la
      const { data: subData, error } = await supabase
        .from('subscriptions_history')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && subData) {
        // Filtre pou jwenn sèlman dènye abònman pou chak plan nan chak boutik
        const uniqueSubs = new Map();
        subData.forEach(sub => {
          const key = `${sub.plan_name}-${sub.shop_name}`;
          if (!uniqueSubs.has(key)) {
            uniqueSubs.set(key, sub);
          }
        });
        setSubscriptions(Array.from(uniqueSubs.values()));
      }
      setLoading(false);
    }
    fetchMySubscriptions();
  }, [supabase, router]);

  // FONKSYON POU ANILE ABÒNMAN AN
  const handleCancelSubscription = async (sub: any) => {
    const isConfirmed = window.confirm(`Èske w sèten ou vle anile abònman "${sub.plan_name}" nan ${sub.shop_name}? Yo pap koupe kòb sou kat ou ankò pou sèvis sa a.`);
    if (!isConfirmed) return;

    setProcessingId(sub.id);

    try {
      // Mete ajou estati abònman an nan tab la
      const { error } = await supabase
        .from('subscriptions_history')
        .update({ status: 'cancelled' })
        .eq('id', sub.id);

      if (error) throw error;

      // Mete UI a ajou san rafrechi paj la
      setSubscriptions(subscriptions.map(s => 
        s.id === sub.id ? { ...s, status: 'cancelled' } : s
      ));
      
      alert("Abònman ou an anile avèk siksè. Ou p ap peye pou li ankò.");
      
    } catch (err: any) {
      alert("Erè lè n ap anile abònman an: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-red-600 mb-4 w-12 h-12" />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 animate-pulse">Chaje Abònman yo...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 sm:p-6 md:p-10 italic font-medium selection:bg-red-600 pb-24">
      <div className="max-w-5xl mx-auto space-y-8 md:space-y-12">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
          <div className="space-y-2 text-center md:text-left">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-all tracking-[0.3em] mb-4 mx-auto md:mx-0">
              <ArrowLeft className="w-4 h-4" /> RETOUNEN
            </button>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic leading-none">
              Abònman <span className="text-red-600">Mwen Yo</span>
            </h1>
            <p className="text-zinc-500 text-[9px] md:text-[11px] font-black uppercase tracking-[0.4em] mt-2">
              Jere ak anile sèvis ou peye chak mwa yo
            </p>
          </div>
        </div>

        {/* LIS ABÒNMAN KLIYAN AN */}
        {subscriptions.length === 0 ? (
          <div className="bg-[#0d0e1a] border border-white/5 rounded-[3rem] p-12 md:p-24 text-center shadow-2xl">
            <RefreshCcw className="mx-auto text-zinc-800 mb-6 w-16 h-16" />
            <p className="text-zinc-500 font-black uppercase text-[10px] md:text-[12px] tracking-[0.4em]">Ou pa gen okenn abònman aktif</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {subscriptions.map((sub) => {
              const isCancelled = sub.status === 'cancelled';
              const planName = sub.plan_name || 'Abònman';
              const merchantName = sub.shop_name || 'Biznis';
              const amount = Math.abs(sub.amount).toLocaleString();

              return (
                <div key={sub.id} className={`bg-[#0d0e1a] border ${isCancelled ? 'border-zinc-800 opacity-70' : 'border-white/5 hover:border-red-600/30'} rounded-[2.5rem] p-6 md:p-8 transition-all duration-300 shadow-2xl relative overflow-hidden flex flex-col`}>
                  
                  {/* Badge Status */}
                  <div className={`absolute top-6 right-6 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isCancelled ? 'bg-zinc-900 text-zinc-500' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                    {isCancelled ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    {isCancelled ? 'Anile' : 'Aktif'}
                  </div>

                  <div className="flex items-center gap-4 mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isCancelled ? 'bg-zinc-900 text-zinc-600' : 'bg-red-600/10 text-red-500 border border-red-600/20'}`}>
                      <RefreshCcw className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter truncate max-w-[200px]">{planName}</h3>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Nan: {merchantName}</p>
                    </div>
                  </div>

                  <div className="bg-black/40 p-4 rounded-2xl border border-white/5 mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Dènye Peman</span>
                      <span className="text-[10px] font-bold text-white">{new Date(sub.created_at).toLocaleDateString('fr-HT')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Montan</span>
                      <span className="text-sm font-black text-white">{amount} HTG</span>
                    </div>
                  </div>

                  {/* Bouton Anile a */}
                  <div className="mt-auto">
                    {isCancelled ? (
                      <div className="w-full bg-zinc-900 text-zinc-600 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest text-center border border-white/5 flex items-center justify-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Abònman sa anile
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleCancelSubscription(sub)}
                        disabled={processingId === sub.id}
                        className="w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 border border-red-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {processingId === sub.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" /> Anile Abònman an
                          </>
                        )}
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}