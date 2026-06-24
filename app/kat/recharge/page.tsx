"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { ArrowLeft, CreditCard, Loader2, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 flex flex-col font-sans overflow-x-hidden">
      
      <div className="max-w-md mx-auto w-full">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8 mt-2">
          <button 
            onClick={() => router.back()} 
            className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="text-right">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Rechaje Kat</h1>
            <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-widest leading-none mt-1">Transfè Entèn</p>
          </div>
        </div>

        {/* DUAL BALANCE DISPLAY */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2 text-slate-500">
              <Wallet size={14} />
              <p className="text-xs font-bold uppercase tracking-wider">Wallet</p>
            </div>
            <p className="text-xl font-bold text-slate-900 truncate">
              {Number(userData?.wallet_balance || 0).toLocaleString()} <span className="text-[10px] text-slate-500 font-semibold ml-0.5">HTG</span>
            </p>
          </div>
          
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2 text-indigo-600">
              <CreditCard size={14} />
              <p className="text-xs font-bold uppercase tracking-wider">Kat Vityèl</p>
            </div>
            <p className="text-xl font-bold text-indigo-600 truncate">
              {Number(userData?.card_balance || 0).toLocaleString()} <span className="text-[10px] text-indigo-400 font-semibold ml-0.5">HTG</span>
            </p>
          </div>
        </div>

        {/* FÒMILÈ */}
        <div className="bg-white border border-gray-200 p-6 sm:p-8 rounded-3xl shadow-sm mb-6">
          <label className="text-xs font-bold uppercase text-slate-500 text-center block mb-6 tracking-wider">
            Montan pou Rechaje
          </label>
          
          <div className="relative mb-4">
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent text-4xl sm:text-5xl font-bold text-center outline-none border-b-2 border-gray-200 focus:border-indigo-600 pb-4 transition-colors text-slate-900 placeholder:text-gray-300"
              placeholder="0"
            />
          </div>

          <div className="text-center mb-8">
            <p className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${Number(amount) > LIMIT_MAKSIMOM ? 'text-rose-500' : 'text-slate-400'}`}>
              Limit maksimòm: {LIMIT_MAKSIMOM.toLocaleString()} HTG
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-gray-100 space-y-3 mb-8">
             <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>Frè Depo</span>
                <span className="text-emerald-600">Gratis</span>
             </div>
             <div className="h-px bg-gray-200 w-full"></div>
             <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                <span className="text-slate-700">Total pou Resevwa</span>
                <span className="text-indigo-600 text-sm">{amount ? Number(amount).toLocaleString() : '0.00'} HTG</span>
             </div>
          </div>

          <button 
            onClick={handleRecharge}
            disabled={loading || !amount || Number(amount) > LIMIT_MAKSIMOM}
            className={`w-full py-4 rounded-xl font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm
              ${loading || !amount || Number(amount) > LIMIT_MAKSIMOM 
                ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed shadow-none' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'
              }
            `}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CreditCard size={18} /> Konfime Rechaj La
              </>
            )}
          </button>
        </div>

        {/* STATUS NOTIFICATION */}
        {status.msg && (
          <div className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-300 border
            ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}
          `}>
            {status.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
            <p className="text-xs font-bold leading-tight">{status.msg}</p>
          </div>
        )}
      </div>

    </div>
  );
}