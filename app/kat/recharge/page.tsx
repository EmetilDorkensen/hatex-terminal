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
    
    if (!val || val <= 0) return setStatus({ type: 'error', msg: 'Antre yon montan ki valid' });
    if (val > LIMIT_MAKSIMOM) return setStatus({ type: 'error', msg: `Limit la se ${LIMIT_MAKSIMOM.toLocaleString()} HTG` });
    if (val > userData.wallet_balance) return setStatus({ type: 'error', msg: 'Kòb nan Wallet ou pa ase' });

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
        setStatus({ type: 'error', msg: data?.message || 'Echèk nan sistèm nan' });
      }
    } catch (err: any) {
      console.error("Erè:", err);
      setStatus({ type: 'error', msg: 'Erè 400: SQL la gen yon pwoblèm.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans relative flex flex-col overflow-x-hidden">
      {/* BACKGROUND GLOW */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-red-600/10 blur-[120px] rounded-full rotate-45"></div>
      <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[30%] bg-red-900/5 blur-[100px] rounded-full"></div>

      {/* HEADER PRO */}
      <div className="flex items-center justify-between mb-12">
        <button onClick={() => router.back()} className="w-14 h-14 bg-zinc-900/50 rounded-2xl border border-white/5 flex items-center justify-center text-xl shadow-2xl active:scale-90 transition-all">
          <span className="not-italic">←</span>
        </button>
        <div className="text-right">
          <h1 className="text-[14px] font-black uppercase italic tracking-widest text-white">Rechaje Kat</h1>
          <p className="text-[8px] text-red-600 font-black uppercase tracking-[0.3em] leading-none">HatexCard Secure</p>
        </div>
      </div>

      {/* RESIME BALANS (DUAL VIEW) */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-5 rounded-[2rem] border border-white/5 backdrop-blur-md">
          <p className="text-[8px] text-zinc-500 font-black uppercase mb-2">Wallet Prensipal</p>
          <p className="text-lg font-black italic truncate">{Number(userData?.wallet_balance || 0).toLocaleString()} <span className="text-[10px] text-red-600">HTG</span></p>
        </div>
        <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-5 rounded-[2rem] border border-white/5 backdrop-blur-md">
          <p className="text-[8px] text-zinc-500 font-black uppercase mb-2">Balans Kat la</p>
          <p className="text-lg font-black italic text-red-600 truncate">{Number(userData?.card_balance || 0).toLocaleString()} <span className="text-[10px] text-white">HTG</span></p>
        </div>
      </div>

      {/* CARD INTERFACE FORM */}
      <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-[3rem] backdrop-blur-3xl shadow-2xl relative mb-10 overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-red-600/10 transition-all duration-700"></div>
        
        <div className="text-center mb-10">
          <label className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.4em] block mb-4">Montan Rechaj</label>
          <div className="flex items-center justify-center gap-2">
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent text-6xl font-black italic text-center outline-none border-b-2 border-zinc-800 focus:border-red-600 pb-4 transition-all"
              placeholder="0"
            />
          </div>
          <p className={`mt-4 text-[9px] font-black uppercase italic tracking-widest ${Number(amount) > LIMIT_MAKSIMOM ? 'text-red-500 animate-pulse' : 'text-zinc-600'}`}>
            Limit maksimòm: 70,000.00 HTG
          </p>
        </div>

        {/* DETAILS TRANZAKSYON */}
        <div className="space-y-4 mb-10">
          <div className="flex justify-between border-b border-white/5 pb-3">
            <span className="text-[9px] text-zinc-500 font-black uppercase italic">Frè Transfè</span>
            <span className="text-[9px] text-green-500 font-black uppercase italic">0.00 HTG (Gratis)</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-3">
            <span className="text-[9px] text-zinc-500 font-black uppercase italic">Nouvo Balans Kat</span>
            <span className="text-[9px] text-white font-black uppercase italic">
              {Number(amount) ? (Number(userData?.card_balance || 0) + Number(amount)).toLocaleString() : '---'} HTG
            </span>
          </div>
        </div>

        <button 
          onClick={handleRecharge}
          disabled={loading || !amount || Number(amount) > LIMIT_MAKSIMOM}
          className={`w-full py-6 rounded-[2.2rem] font-black uppercase italic text-[14px] tracking-[0.2em] transition-all shadow-2xl flex items-center justify-center gap-4
            ${loading || Number(amount) > LIMIT_MAKSIMOM ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-red-600 text-white active:scale-95 hover:bg-red-500'}
          `}
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          ) : (
            <><span>💳</span> Konfime Rechaj la</>
          )}
        </button>
      </div>

      {/* STATUS TOAST */}
      {status.msg && (
        <div className={`p-6 rounded-[2rem] text-center border animate-in slide-in-from-bottom-5 duration-500
          ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}
        `}>
          <p className="text-[11px] font-black uppercase italic tracking-widest leading-relaxed">{status.msg}</p>
        </div>
      )}

      {/* FOOTER LOGO/SLOGAN */}
      <div className="mt-auto py-10 flex flex-col items-center gap-2 opacity-20">
        <div className="w-8 h-[2px] bg-white"></div>
        <p className="text-[8px] font-black uppercase tracking-[0.5em]">HatexCard Global</p>
      </div>
    </div>
  );
}