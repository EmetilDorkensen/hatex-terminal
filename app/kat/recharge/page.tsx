"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function RechargeKatPage() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [status, setStatus] = useState({ type: '', msg: '' });

  const LIMIT_MAKSIMOM = 50000;

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, wallet_balance, card_balance')
          .eq('id', user.id)
          .single();
        setUserData(profile);
      } else {
        router.push('/login');
      }
    };
    fetchUser();
  }, [supabase, router]);

  const handleRecharge = async () => {
    const val = Number(amount); // Asire sa se yon Number
    
    if (!val || val <= 0) return setStatus({ type: 'error', msg: 'Mete yon montan valid' });
    if (val > 50000) return setStatus({ type: 'error', msg: 'Limit la se 50,000 HTG' });
  
    setLoading(true);
    setStatus({ type: '', msg: '' });
  
    try {
      // Tcheke non paramèt yo byen (p_user_id ak p_amount)
      const { data, error } = await supabase.rpc('process_card_recharge', {
        p_user_id: userData.id,
        p_amount: val 
      });
  
      if (error) {
        console.error("Detay Erè Supabase:", error); // Sa ap ede w wè egzakteman sak pa mache
        throw error;
      }
  
      if (data && data.success) {
        setStatus({ type: 'success', msg: data.message });
        setTimeout(() => router.push('/kat'), 2000);
      } else {
        setStatus({ type: 'error', msg: data?.message || 'Erè nan tranzaksyon an' });
      }
  
    } catch (err: any) {
      console.error("Erè Konplè:", err);
      setStatus({ type: 'error', msg: 'Sistèm nan okipe (Erè 400). Re-eseye.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans relative flex flex-col">
      {/* BACKGROUND EFFECT */}
      <div className="absolute top-0 left-0 w-full h-64 bg-red-600/10 blur-[100px] -z-10 rounded-full scale-150"></div>

      {/* HEADER */}
      <div className="flex items-center gap-4 mb-10">
        <button 
          onClick={() => router.back()} 
          className="w-12 h-12 bg-zinc-900 rounded-2xl border border-white/5 flex items-center justify-center text-xl active:scale-90 transition-all shadow-xl"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-black uppercase italic tracking-tighter">Rechaje Kat</h1>
          <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.2em]">Sistèm Sekirize 256-Bit</p>
        </div>
      </div>

      {/* BALANS DISPONIB */}
      <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[2.5rem] backdrop-blur-md mb-8">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Balans Wallet Prensipal</p>
            <p className="text-2xl font-black italic">
              {Number(userData?.wallet_balance || 0).toLocaleString()} 
              <span className="text-xs text-red-600 ml-1">HTG</span>
            </p>
          </div>
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-xl italic font-black text-red-600">
            H
          </div>
        </div>
      </div>

      {/* FÒMILÈ RECHAJ */}
      <div className="bg-zinc-900/80 border border-white/10 p-8 rounded-[3rem] backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        <label className="text-[10px] font-black uppercase text-zinc-500 mb-8 block tracking-[0.2em] text-center">
          Antre Montan an
        </label>
        
        <div className="relative mb-4">
          <input 
            type="number" 
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent text-5xl font-black italic text-center outline-none border-b-2 border-zinc-800 focus:border-red-600 pb-6 transition-all"
          />
        </div>

        {/* LIMIT INDICATOR */}
        <div className="mb-10 text-center">
          <p className={`text-[9px] font-black uppercase italic transition-all duration-300 ${Number(amount) > LIMIT_MAKSIMOM ? 'text-red-500 animate-pulse scale-110' : 'text-zinc-600'}`}>
            {Number(amount) > LIMIT_MAKSIMOM ? `⚠️ Limit depase (${LIMIT_MAKSIMOM.toLocaleString()} HTG)` : `Limit maksimòm: ${LIMIT_MAKSIMOM.toLocaleString()} HTG`}
          </p>
        </div>

        <button 
          onClick={handleRecharge}
          disabled={loading || !amount || Number(amount) > LIMIT_MAKSIMOM}
          className={`w-full py-6 rounded-[2rem] font-black uppercase italic text-[13px] tracking-widest transition-all shadow-2xl flex items-center justify-center gap-3
            ${loading || Number(amount) > LIMIT_MAKSIMOM ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-white text-black active:scale-95 shadow-white/5'}
          `}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
          ) : (
            "Konfime Transfè a"
          )}
        </button>
      </div>

      {/* STATUS MESSAGE */}
      {status.msg && (
        <div className={`mt-8 p-6 rounded-[2rem] text-center border animate-in slide-in-from-bottom-4 duration-500
          ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}
        `}>
          <p className="text-[10px] font-black uppercase italic tracking-widest">{status.msg}</p>
        </div>
      )}

      {/* FOOTER INFO */}
      <div className="mt-auto py-8 text-center opacity-40">
        <p className="text-[7px] font-black uppercase tracking-[0.3em]">HatexCard Internal Transfer Protocol v2.0</p>
      </div>
    </div>
  );
}