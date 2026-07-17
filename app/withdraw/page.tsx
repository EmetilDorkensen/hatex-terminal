"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertTriangle, ShieldCheck, Wallet, ArrowUpRight, Lock, CheckCircle2, Store } from 'lucide-react';
import { checkSpendingLimit, calcAgentWithdrawFee } from '@/lib/security/spending-limits';
import { isKycApproved } from '@/lib/kyc/status';

export default function WithdrawPage() {
  const router = useRouter();
  const [amount, setAmount] = useState<number | ''>('');
  const [phone, setPhone] = useState('');
  const [agentCode, setAgentCode] = useState('');
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

  const [withdrawFeePercent, setWithdrawFeePercent] = useState(5);
  const [agentWithdrawPer1000, setAgentWithdrawPer1000] = useState(50);
  const [vipThreshold, setVipThreshold] = useState(15000);
  const [minWithdraw, setMinWithdraw] = useState(500);

  const currentAmount = Number(amount) || 0;
  const isLargeWithdrawal = currentAmount > vipThreshold && method !== 'Ajan';
  const isAgentMethod = method === 'Ajan';

  // MonCash/NatCash: frè % retire nan montan
  // Ajan: frè /1000 ANPLIS montan kach
  const agentFee = isAgentMethod ? calcAgentWithdrawFee(currentAmount, agentWithdrawPer1000) : null;
  const withdrawFee = isAgentMethod
    ? (agentFee?.fee || 0)
    : isLargeWithdrawal
      ? 0
      : currentAmount * (withdrawFeePercent / 100);
  const netAmount = isAgentMethod ? currentAmount : currentAmount - withdrawFee;
  const totalDebit = isAgentMethod ? (agentFee?.totalDebit || 0) : currentAmount;

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, wallet_balance, account_status, account_type, kyc_status, pin_code_hash, transaction_pin_hash, pin_enabled')
          .eq('id', user.id)
          .single();
        if (data) {
           setProfile(data);
           try {
             const [feeRes, limRes] = await Promise.all([
               fetch('/api/fees/mine'),
               fetch('/api/limits/mine'),
             ]);
             const feeData = await feeRes.json().catch(() => ({}));
             const limData = await limRes.json().catch(() => ({}));
             if (feeRes.ok && feeData.fees) {
               if (feeData.fees.withdraw_fee_percent != null) {
                 setWithdrawFeePercent(Number(feeData.fees.withdraw_fee_percent));
               }
               if (feeData.fees.agent_withdraw_fee_per_1000 != null) {
                 setAgentWithdrawPer1000(Number(feeData.fees.agent_withdraw_fee_per_1000));
               }
             }
             if (limRes.ok && limData.limits) {
               if (limData.limits.vip_withdraw_threshold != null) {
                 setVipThreshold(Number(limData.limits.vip_withdraw_threshold));
               }
               if (limData.limits.min_withdraw != null) {
                 setMinWithdraw(Number(limData.limits.min_withdraw));
               }
             }
           } catch { /* defaults */ }
           if (!isKycApproved(data.kyc_status)) {
               return;
           }
           if (!data.transaction_pin_hash && !data.pin_code_hash) {
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
  // LOJIK POU TCHEKE LIMIT LA AK BAZ DONE A
  // ==========================================
  const initiateWithdrawal = async () => {
    setLoading(true);

    try {
      // 1. TCHEKE ESTATI A DIRÈK NAN BAZ DONE A KOUNYE A
      const { data: statusCheck, error: statusErr } = await supabase
        .from('profiles')
        .select('account_status, account_type')
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

      const { data: kycProf } = await supabase.from('profiles').select('kyc_status').eq('id', profile.id).single();
      if (!isKycApproved(kycProf?.kyc_status)) {
        setLoading(false);
        return alert("Ou dwe pase KYC anvan ou ka fè retrè.");
      }

      // 3. TCHEKE LIMIT JOUNALYE/MANSYÈL POU KONT ENDIVIDYÈL YO
      //    (Kont Antrepriz apwouve gen retrè ILIMITE)
      const amountForLimit = method === 'Ajan'
        ? calcAgentWithdrawFee(currentAmount, agentWithdrawPer1000).totalDebit
        : currentAmount;
      const limitCheck = await checkSpendingLimit(supabase, profile.id, statusCheck.account_type, amountForLimit, 'withdraw');
      if (!limitCheck.allowed) {
          setLoading(false);
          return alert(`${limitCheck.message}\n\nPase nan Kont Antrepriz pou retrè ilimite (bouton "Vin Kont Antrepriz" nan Tablodbò a).`);
      }

      // 4. KONDISYON DEBAZ YO
      if (currentAmount < minWithdraw) {
        setLoading(false);
        return alert(`Minimòm retrè se ${minWithdraw.toLocaleString()} HTG`);
      }
      const neededBalance = method === 'Ajan'
        ? calcAgentWithdrawFee(currentAmount, agentWithdrawPer1000).totalDebit
        : currentAmount;
      if (neededBalance > (profile?.wallet_balance || 0)) {
        setLoading(false);
        return alert(
          method === 'Ajan'
            ? `Ou pa gen ase kòb. Ou bezwen ${neededBalance.toLocaleString()} HTG (montan kach + frè).`
            : "Ou pa gen ase kòb sou kont ou pou montan sa a."
        );
      }
      
      // Valide Enfòmasyon Metòd yo
      if (method === 'Ajan') {
          if (!agentCode || agentCode.length !== 8) {
              setLoading(false);
              return alert("Tanpri mete Kòd 8-Chif Ajan an kòrèkteman.");
          }
      } else {
          if (!phone && !isLargeWithdrawal) {
              setLoading(false);
              return alert("Tanpri mete nimewo telefòn ou"); 
          }
      }

      // Tout bagay fre, nou mande PIN nan
      setPinError('');
      setEnteredPin('');
      setShowPinPrompt(true);

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
      const pinRes = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin: enteredPin }),
      });
      const pinData = await pinRes.json();
      if (!pinRes.ok || !pinData.success) {
        throw new Error(pinData.message || "PIN ou antre a pa bon. Tranzaksyon an anile.");
      }

      // Fonksyon SQL 'process_wallet_withdrawal' la fè TOUT verifikasyon yo
      // (estati kont, KYC, balans) AK debi/kredi a ATOMIKMAN nan baz done a —
      // nou pa voye okenn "nouvo balans" kalkile bò kote navigatè a ankò.
      const { data: rpcResult, error: rpcError } = await supabase.rpc('process_wallet_withdrawal', {
        p_user_id: profile.id,
        p_amount: currentAmount,
        p_method: method,
        p_phone: phone || null,
        p_agent_code: method === 'Ajan' ? agentCode : null,
        p_user_email: profile.email,
      });

      if (rpcError) throw new Error(rpcError.message || "Sistèm nan jwenn yon pwoblèm.");
      if (!rpcResult?.success) throw new Error(rpcResult?.message || "Retrè a echwe. Tanpri re-eseye.");

      if (rpcResult.is_agent) {
        setShowPinPrompt(false);
        alert(
          `Tranzaksyon an reyisi!\n\n` +
          `Ajan ${rpcResult.agent_name} resevwa demann lan.\n` +
          `Mande ajan an ba ou ${Number(rpcResult.cash_amount || rpcResult.net_amount).toLocaleString()} HTG kach.\n` +
          `Frè: ${Number(rpcResult.fee || 0).toLocaleString()} HTG (yo retire sou kont ou).`
        );
        router.push('/dashboard');
        return;
      }

      const msg = rpcResult.is_large
        ? `🚨 *GWO DEMANN RETRÈ VIP*\n\n👤: ${profile.full_name}\n💰 Montan: ${currentAmount} HTG\n⚠️ _Montan an plis pase ${vipThreshold.toLocaleString()} HTG._`
        : `💸 *DEMANN RETRÈ NOUVO*\n\n👤: ${profile.full_name}\n💰 Brits: ${currentAmount} HTG\n📉 Frè (${withdrawFeePercent}%): ${rpcResult.fee} HTG\n✅ Nèt pou voye: ${rpcResult.net_amount} HTG\n📲: ${method} (${phone})`;

      await fetch('/api/notifications/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'finance', message: msg, parseMode: 'Markdown' }),
      });

      setShowPinPrompt(false);
      
      if (rpcResult.is_large) {
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

  if (profile && !isKycApproved(profile.kyc_status)) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-white border border-amber-200 rounded-3xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">KYC obligatwa pou retrè</h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Ou ka fè depo san KYC, men pou retire lajan ou dwe verifye idantite w anvan.
          </p>
          <button onClick={() => router.push('/kyc')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold text-sm mb-3">
            Pase Verifikasyon ID
          </button>
          <button onClick={() => router.push('/dashboard')} className="w-full border border-gray-200 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-50">
            Tounen Dashboard
          </button>
        </div>
      </div>
    );
  }

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
              Mete PIN 4 chif ou a pou w ka retire{' '}
              <span className="font-bold text-slate-800">{currentAmount.toLocaleString()} HTG</span>
              {isAgentMethod && withdrawFee > 0 && (
                <> (frè {withdrawFee.toLocaleString()} HTG — total debit {totalDebit.toLocaleString()} HTG)</>
              )}
              {' '}sou kont ou.
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
                   {isAgentMethod ? (
                     <>
                       <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                         <span>Montan kach ou resevwa:</span>
                         <span className="font-bold text-emerald-600">{currentAmount.toLocaleString()} HTG</span>
                       </div>
                       <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                         <span>Frè (50 HTG / 1,000):</span>
                         <span className="font-bold text-rose-600">+{withdrawFee.toLocaleString()} HTG</span>
                       </div>
                       <div className="h-px bg-gray-200 w-full"></div>
                       <div className="flex justify-between items-center text-sm font-bold text-slate-800">
                         <span>Total yo retire sou kont ou:</span>
                         <span className="text-indigo-600">{totalDebit.toLocaleString()} HTG</span>
                       </div>
                       <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center mt-2">
                         Ajan
                       </p>
                     </>
                   ) : (
                     <>
                       <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                         <span>Frè Hatexcard (5%):</span>
                         <span className="font-bold text-rose-600">-{withdrawFee.toFixed(2)} HTG</span>
                       </div>
                       <div className="h-px bg-gray-200 w-full"></div>
                       <div className="flex justify-between items-center text-sm font-bold text-slate-800">
                         <span>Nèt ou pral resevwa:</span>
                         <span className="text-indigo-600">{netAmount.toFixed(2)} HTG</span>
                       </div>
                     </>
                   )}
                 </div>
               )}
              
               {isLargeWithdrawal && (
                 <div className="mt-8 bg-amber-50 border border-amber-200 p-5 rounded-xl text-center shadow-sm">
                    <ShieldCheck size={28} className="text-amber-500 mx-auto mb-2" />
                    <p className="text-xs font-bold uppercase text-amber-800 tracking-wider leading-relaxed">
                      Transfè VIP (&gt; {vipThreshold.toLocaleString()} HTG)
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chwazi Kote W Ap Retire Lajan an</label>
                  <select 
                     value={method} 
                     onChange={(e) => setMethod(e.target.value)} 
                     disabled={profile?.account_status === 'suspended'}
                     className="w-full bg-slate-50 p-4 rounded-xl border border-gray-200 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm disabled:opacity-50"
                  >
                     <option value="Ajan">Kach nan Pwen Ajan Hatex</option>
                     <option value="MonCash">MonCash</option>
                     <option value="NatCash">NatCash</option>
                  </select>
                </div>
                
                {method === 'Ajan' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kòd 8-Chif Ajan an</label>
                    <div className="relative">
                      <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input 
                         type="text" 
                         placeholder="EG: 04958123" 
                         maxLength={8}
                         value={agentCode} 
                         onChange={(e) => setAgentCode(e.target.value.replace(/[^0-9]/g, ''))} 
                         disabled={profile?.account_status === 'suspended'}
                         className="w-full bg-slate-50 p-4 pl-12 rounded-xl outline-none border border-gray-200 text-sm font-bold text-slate-800 font-mono tracking-widest focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm disabled:opacity-50 placeholder:text-gray-300 placeholder:tracking-normal" 
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-2">Mande ajan an kòd li a epi asire w li korèk pou kòb la pa pèdi.</p>
                  </div>
                ) : (
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
                )}
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