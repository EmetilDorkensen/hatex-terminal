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

  const LIMIT_MAKSIMOM = 70000;

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setUserData(profile);
      } else { router.push('/login'); }
    };
    fetchUser();
  }, [supabase, router]);

  const handleRecharge = async () => {
    const val = Number(parseFloat(amount).toFixed(2));
    
    if (!val || val <= 0) return setStatus({ type: 'error', msg: 'Antre yon montan valid' });
    if (val > LIMIT_MAKSIMOM) return setStatus({ type: 'error', msg: `Ou depase limit ${LIMIT_MAKSIMOM.toLocaleString()} HTG a` });
    if (val > userData?.wallet_balance) return setStatus({ type: 'error', msg: 'Kòb nan Wallet ou pa ase' });

    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const { data, error } = await supabase.rpc('process_card_recharge', {
        p_user_id: userData.id,
        p_amount: val 
      });

      if (error) throw error;

      if (data && data.success) {
        setStatus({ type: 'success', msg: data.message });
        setAmount('');
        setTimeout(() => router.push('/kat'), 2500);
      } else {
        setStatus({ type: 'error', msg: data?.message || 'Echèk tranzaksyon' });
      }
    } catch (err: any) {
      console.error("Erè:", err);
      setStatus({ type: 'error', msg: 'Erè 400: SQL la pako ajou nan baz de done a.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic flex flex-col font-sans overflow-hidden">
      <div className="absolute top-0 right-0 p-10 opacity-5 text-7xl font-black italic select-none">HATEX</div>

      {/* HEADER */}
      <div className="flex items-center justify-between mb-12">
        <button onClick={() => router.back()} className="w-14 h-14 bg-zinc-900/50 rounded-2xl border border-white/5 flex items-center justify-center shadow-2xl active:scale-90 transition-all">
          <span className="not-italic text-xl">←</span>
        </button>
        <div className="text-right">
          <h1 className="text-[16px] font-black uppercase italic tracking-tighter">Rechaje Kat</h1>
          <p className="text-[7px] text-red-600 font-black uppercase tracking-[0.3em] leading-none">Secure Transfer</p>
        </div>
      </div>

      {/* DUAL BALANCE DISPLAY */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-zinc-900/40 p-6 rounded-[2.2rem] border border-white/5 backdrop-blur-md">
          <p className="text-[8px] text-zinc-500 font-black uppercase mb-1">Wallet</p>
          <p className="text-xl font-black italic">{Number(userData?.wallet_balance || 0).toLocaleString()} <span className="text-[9px] text-red-600">HTG</span></p>
        </div>
        <div className="bg-zinc-900/40 p-6 rounded-[2.2rem] border border-white/5 backdrop-blur-md">
          <p className="text-[8px] text-zinc-500 font-black uppercase mb-1">Kat</p>
          <p className="text-xl font-black italic text-red-600">{Number(userData?.card_balance || 0).toLocaleString()} <span className="text-[9px] text-white">HTG</span></p>
        </div>
      </div>

      {/* FORMULAIRE */}
      <div className="bg-zinc-900/60 border border-white/10 p-10 rounded-[3.5rem] backdrop-blur-3xl shadow-2xl relative mb-12">
        <label className="text-[10px] font-black uppercase text-zinc-500 text-center block mb-8 tracking-[0.4em]">Montan pou Rechaje</label>
        
        <div className="relative mb-6">
          <input 
            type="number" 
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent text-6xl font-black italic text-center outline-none border-b-2 border-zinc-800 focus:border-red-600 pb-6 transition-all"
            placeholder="0"
          />
        </div>

        <div className="text-center mb-10">
          <p className={`text-[9px] font-black uppercase italic tracking-widest ${Number(amount) > LIMIT_MAKSIMOM ? 'text-red-500 animate-pulse' : 'text-zinc-600'}`}>
            Limit maksimòm: {LIMIT_MAKSIMOM.toLocaleString()}.00 HTG
          </p>
        </div>

        <div className="space-y-4 mb-10 border-t border-white/5 pt-8">
           <div className="flex justify-between text-[10px] font-black uppercase italic">
              <span className="text-zinc-500">Frè Depo</span>
              <span className="text-green-500">GRATIS (0.00 HTG)</span>
           </div>
           <div className="flex justify-between text-[10px] font-black uppercase italic">
              <span className="text-white">Total pou Resevwa</span>
              <span className="text-red-600">{amount ? Number(amount).toLocaleString() : '0.00'} HTG</span>
           </div>
        </div>

        <button 
          onClick={handleRecharge}
          disabled={loading || !amount || Number(amount) > LIMIT_MAKSIMOM}
          className={`w-full py-7 rounded-[2.5rem] font-black uppercase italic text-[14px] tracking-[0.2em] flex items-center justify-center gap-4 transition-all
            ${loading || Number(amount) > LIMIT_MAKSIMOM ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-red-600 text-white active:scale-95 shadow-[0_15px_40px_rgba(220,38,38,0.3)]'}
          `}
        >
          {loading ? (
            <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
          ) : (
            <><span>💳</span> KONFIME RECHAJ LA</>
          )}
        </button>
      </div>

      {/* STATUS NOTIFICATION */}
      {status.msg && (
        <div className={`p-6 rounded-[2.2rem] text-center border animate-in slide-in-from-bottom-5 duration-500
          ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}
        `}>
          <p className="text-[11px] font-black uppercase italic tracking-widest">{status.msg}</p>
        </div>
      )}
    </div>
  );
}