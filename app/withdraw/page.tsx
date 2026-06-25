"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertTriangle, ShieldCheck, Wallet, ArrowUpRight, Lock, CheckCircle2 } from 'lucide-react';

export default function WithdrawPage() {
  const router = useRouter();
  const [amount, setAmount] = useState<number | ''>('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('MonCash');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const currentAmount = Number(amount) || 0;
  const isLargeWithdrawal = currentAmount > 15000;
  
  const withdrawFee = isLargeWithdrawal ? 0 : currentAmount * 0.05;
  const netAmount = currentAmount - withdrawFee;

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
           setProfile(data);
           if (!data.transaction_pin) {
               alert("Ou dwe gen yon kòd PIN pou sekirize kont ou anvan ou ka retire lajan.");
               router.push('/setting'); 
           }
        }
      } else {
        router.push('/login');
      }
    };
    fetchProfile();
  }, [supabase, router]);

  // ==========================================
  // LOJIK POU TCHEKE BAZ DONE A FRECH
  // ==========================================
  const initiateWithdrawal = async () => {
    setLoading(true);

    try {
      // 1. AL CHÈCHE ESTATI A DIRÈK NAN TAB PROFILES LA KOUNYE A
      const { data: statusCheck, error: statusErr } = await supabase
        .from('profiles')
        .select('account_status')
        .eq('id', profile.id)
        .single();

      if (statusErr || !statusCheck) {
        setLoading(false);
        return alert("Sistèm nan pa jwenn kont ou pou verifye l.");
      }

      // 2. BLOKE SI L SISPANDI
      if (statusCheck.account_status === 'suspended') {
        setLoading(false);
        return alert("Kont ou a sispandi. Ou pa gen otorizasyon pou w fè retrè.");
      }

      // 3. KITE L PASE SI L ACTIVE AK LÒT KONDISYON YO
      if (statusCheck.account_status === 'active') {
        if (currentAmount < 500) {
          setLoading(false);
          return alert("Minimòm retrè se 500 HTG");
        }
        if (currentAmount > (profile?.wallet_balance || 0)) {
          setLoading(false);
          return alert("Ou pa gen ase kòb sou kont ou.");
        }
        if (!phone && !isLargeWithdrawal) {
          setLoading(false);
          return alert("Tanpri mete nimewo telefòn ou"); 
        }

        // Tout bagay fre, nou mande PIN nan
        setPinError('');
        setEnteredPin('');
        setShowPinPrompt(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const executeWithdrawal = async () => {
    if (enteredPin.length !== 4) {
      setPinError("PIN nan dwe gen 4 chif");
      return;
    }

    setLoading(true);
    setPinError('');

    try {
      const { data: checkData, error: checkErr } = await supabase
        .from('profiles')
        .select('transaction_pin, wallet_balance, account_status')
        .eq('id', profile.id)
        .single();
        
      if (checkErr || !checkData) throw new Error("Nou pa jwenn kont ou.");
      
      // Tcheke yon dènye fwa jis pou sekirite absoli
      if (checkData.account_status === 'suspended') {
        throw new Error("Kont ou a sispandi. Tranzaksyon an anile otomatikman.");
      }

      if (checkData.transaction_pin !== enteredPin) {
        throw new Error("PIN ou antre a pa bon. Tranzaksyon an anile.");
      }
      
      if (currentAmount > Number(checkData.wallet_balance)) {
         throw new Error("Ou pa gen ase kòb pou tranzaksyon sa a.");
      }

      const nouvoBalans = Number(checkData.wallet_balance) - currentAmount;
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ wallet_balance: nouvoBalans })
        .eq('id', profile.id);

      if (balanceError) throw new Error("Erè nan mizajou balans ou an. Tanpri re-eseye.");

      const withdrawalMethod = isLargeWithdrawal ? 'VIP_LARGE_TRANSFER' : method;
      const withdrawalPhone = isLargeWithdrawal ? 'Pral bay li bay Sèvis Kliyan' : phone;

      const { error: withdrawError } = await supabase.from('withdrawals').insert([{
        user_id: profile.id,
        amount: currentAmount,
        fee: withdrawFee,
        net_amount: netAmount,
        method: withdrawalMethod,
        phone: withdrawalPhone,
        user_email: profile.email, 
        status: 'pending'
      }]);

      if (withdrawError) {
        await supabase.from('profiles').update({ wallet_balance: checkData.wallet_balance }).eq('id', profile.id);
        throw new Error("Sistèm nan jwenn yon pwoblèm. Nou remèt kòb la sou balans ou.");
      }

      const BOT_TOKEN = '8395029585:AAEZKtLVQhuwk8drzziAIJeDtHuhjl77bPY';
      const CHAT_ID = '8392894841';
      const msg = isLargeWithdrawal 
        ? `🚨 *GWO DEMANN RETRÈ VIP*\n\n👤: ${profile.full_name}\n💰 Montan: ${currentAmount} HTG\n⚠️ _Montan an plis pase 15,000 HTG._`
        : `💸 *DEMANN RETRÈ NOUVO*\n\n👤: ${profile.full_name}\n💰 Brits: ${currentAmount} HTG\n📉 Frè (5%): ${withdrawFee} HTG\n✅ Nèt pou voye: ${netAmount} HTG\n📲: ${method} (${phone})`;
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown' })
      });

      setShowPinPrompt(false);
      
      if (isLargeWithdrawal) {
          alert("Demann ou a pase! Tanpri kontakte Sèvis Kliyan pou n bay kote nou dwe voye kòb la pou ou.");
      } else {
          alert("Retrè voye! Kòb la retire sou balans ou. N ap voye l nan 15-45 minit.");
      }
      
      router.push('/dashboard');

    } catch (err: any) {
      setPinError(err.message);
      setEnteredPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 font-sans relative flex flex-col items-center">
      
      {/* MODAL POU PIN NAN */}
      {showPinPrompt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
              <Lock size={28} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Konfime Retrè a</h2>
            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
              Mete PIN 4 chif ou a pou w ka retire <span className="font-bold text-slate-800">{currentAmount.toLocaleString()} HTG</span> sou kont ou.
            </p>
            
            <input 
              type="password" maxLength={4} autoFocus placeholder="••••" 
              value={enteredPin} onChange={(e) => setEnteredPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-slate-50 border border-gray-200 p-4 rounded-xl text-center text-3xl font-mono tracking-[0.5em] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-6 text-slate-900 transition-all shadow-sm"
            />

            {pinError && (
               <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg mb-6">
                 <p className="text-xs text-rose-600 font-bold uppercase tracking-wider animate-pulse">{pinError}</p>
               </div>
            )}
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowPinPrompt(false)} disabled={loading}
                className="flex-1 bg-white border border-gray-300 text-slate-700 py-3.5 rounded-xl font-bold uppercase text-xs hover:bg-gray-50 transition-all shadow-sm"
              >
                Anile
              </button>
              <button 
                onClick={executeWithdrawal} disabled={loading || enteredPin.length !== 4}
                className="flex-1 bg-indigo-600 text-white py-3.5 rounded-xl font-bold uppercase text-xs hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-sm flex items-center justify-center"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Konfime"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KONTNI PAJ LA */}
      <div className={`w-full max-w-md transition-all duration-300 ${showPinPrompt ? 'opacity-40 pointer-events-none blur-[2px]' : ''}`}>
        
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-8 mt-2">
          <button 
            onClick={() => router.back()} 
            className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors shadow-sm shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Retire Fon</h1>
            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">Transfè Sekirize</p>
          </div>
        </div>

        <div className="space-y-6">
          
          {profile?.account_status === 'suspended' && (
             <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl text-center shadow-sm flex flex-col items-center gap-3">
                <AlertTriangle size={32} className="text-rose-500" />
                <p className="text-xs text-rose-700 font-bold uppercase tracking-wider leading-relaxed">
                   Kont ou a sispandi. Ou pa gen otorizasyon pou retire lajan.
                </p>
             </div>
          )}

          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-5">
               <ArrowUpRight size={80} />
             </div>
             
             <div className="relative z-10">
               <div className="flex items-center justify-center gap-2 mb-6 text-slate-500">
                 <Wallet size={16} />
                 <p className="text-xs font-bold uppercase tracking-wider">Balans Disponib: <span className="text-slate-800">{profile?.wallet_balance?.toLocaleString() || 0} HTG</span></p>
               </div>
               
               <input 
                  type="number" 
                  value={amount} 
                  onChange={(e) => setAmount(Number(e.target.value))} 
                  disabled={profile?.account_status === 'suspended'}
                  className="w-full bg-transparent text-4xl sm:text-5xl font-bold text-center outline-none border-b-2 border-gray-200 focus:border-indigo-600 pb-4 transition-colors text-slate-900 placeholder:text-gray-300 disabled:opacity-50" 
                  placeholder="0" 
               />
              
               {currentAmount > 0 && !isLargeWithdrawal && (
                 <div className="mt-8 bg-slate-50 border border-gray-100 p-4 rounded-xl space-y-3">
                   <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                     <span>Frè Hatexcard (5%):</span>
                     <span className="font-bold text-rose-600">-{withdrawFee.toFixed(2)} HTG</span>
                   </div>
                   <div className="h-px bg-gray-200 w-full"></div>
                   <div className="flex justify-between items-center text-sm font-bold text-slate-800">
                     <span>Nèt pou resevwa:</span>
                     <span className="text-indigo-600">{netAmount.toFixed(2)} HTG</span>
                   </div>
                 </div>
               )}
              
               {isLargeWithdrawal && (
                 <div className="mt-8 bg-amber-50 border border-amber-200 p-5 rounded-xl text-center shadow-sm">
                    <ShieldCheck size={28} className="text-amber-500 mx-auto mb-2" />
                    {/* 👇 ERÈ A KORIJE LA A 👇 */}
                    <p className="text-xs font-bold uppercase text-amber-800 tracking-wider leading-relaxed">
                      Transfè VIP (&gt; 15,000 HTG)
                    </p>
                    <p className="text-[10px] font-medium text-amber-700 mt-2 leading-relaxed">
                      Transfè sa p ap gen frè otomatikman. W ap bezwen kontakte nou pou n voye lajan an pou ou nan bank oswa kote w pito a.
                    </p>
                 </div>
               )}
             </div>
          </div>
          
          {!isLargeWithdrawal && (
             <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Metòd Pèman</label>
                  <select 
                     value={method} 
                     onChange={(e) => setMethod(e.target.value)} 
                     disabled={profile?.account_status === 'suspended'}
                     className="w-full bg-slate-50 p-4 rounded-xl border border-gray-200 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm disabled:opacity-50"
                  >
                     <option value="MonCash">MonCash</option>
                     <option value="NatCash">NatCash</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nimewo Kont / Telefòn</label>
                  <input 
                     type="text" 
                     placeholder="EG: 44332211" 
                     value={phone} 
                     onChange={(e) => setPhone(e.target.value)} 
                     disabled={profile?.account_status === 'suspended'}
                     className="w-full bg-slate-50 p-4 rounded-xl outline-none border border-gray-200 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm disabled:opacity-50 placeholder:text-gray-400" 
                  />
                </div>
             </div>
          )}

          <button 
            onClick={initiateWithdrawal} 
            disabled={loading || currentAmount <= 0 || profile?.account_status === 'suspended'} 
            className={`w-full py-4 rounded-xl font-bold uppercase text-xs tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 ${loading || currentAmount <= 0 || profile?.account_status === 'suspended' ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'}`}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <><ArrowUpRight size={18} /> Konfime ak Retire</>}
          </button>
        </div>
      </div>
    </div>
  );
}