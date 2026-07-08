"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, User, ShieldCheck, ArrowRightLeft, Lock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { checkSpendingLimit } from '@/lib/security/spending-limits';
import { isKycApproved } from '@/lib/kyc/status';

// ==========================================
// TABLO FRÈ TRANSFÈ (menm estrikti ak MonCash)
// Chak liy: [montanMinimòm, montanMaksimòm, frè]
// ==========================================
const TRANSFER_FEE_TIERS: Array<[number, number, number]> = [
  [100, 249, 0],
  [250, 499, 5],
  [500, 999, 10],
  [1000, 1999, 25],
  [2000, 3999, 35],
  [4000, 7999, 50],
  [8000, 11999, 60],
  [12000, 19999, 70],
  [20000, 39999, 75],
  [40000, 59999, 100],
  [60000, 74999, 120],
  [75000, 100000, 130],
];

const MIN_TRANSFER_AMOUNT = TRANSFER_FEE_TIERS[0][0];
const MAX_TRANSFER_AMOUNT = TRANSFER_FEE_TIERS[TRANSFER_FEE_TIERS.length - 1][1];

function getTransferFee(amount: number): number {
  const tier = TRANSFER_FEE_TIERS.find(([min, max]) => amount >= min && amount <= max);
  return tier ? tier[2] : 0;
}

export default function TransferPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [senderEmail, setSenderEmail] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [accountType, setAccountType] = useState('individual');
  const [kycApproved, setKycApproved] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [receiverName, setReceiverName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [showFeeTable, setShowFeeTable] = useState(false);

  // ==========================================
  // ETA POU SISTÈM PIN NAN
  // ==========================================
  const [hasPin, setHasPin] = useState(true); // Nou sipoze l genyen l jis nou verifye
  const [showCreatePin, setShowCreatePin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  
  const [showPinPrompt, setShowPinPrompt] = useState(false); // Pou mande PIN nan anvan peman
  const [enteredPin, setEnteredPin] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. TCHEKE SI KLIYAN AN GEN YON PIN DEJA LÈ PAJ LA LOUVRI
  useEffect(() => {
    const checkUserPin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setSenderEmail(user.email || '');
        const { data: prof } = await supabase
          .from('profiles')
          .select('wallet_balance, account_type, kyc_status')
          .eq('id', user.id)
          .single();
        setWalletBalance(Number(prof?.wallet_balance || 0));
        setAccountType(prof?.account_type || 'individual');
        setKycApproved(isKycApproved(prof?.kyc_status));
        const statusRes = await fetch('/api/auth/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status' }),
        });
        const statusData = await statusRes.json();
        if (!statusData.hasPin && !statusData.hasTransactionPin && !statusData.hasWalletPin) {
          setHasPin(false);
          setShowCreatePin(true);
        } else {
          setHasPin(true);
        }
      } else {
         router.push('/login');
      }
    };
    checkUserPin();
  }, [supabase, router]);

  // 2. KREYE NOUVO PIN NAN (LÈ L POKO GEN YONN)
  const handleCreatePin = async () => {
    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      alert("PIN nan dwe gen 4 chif sèlman!");
      return;
    }
    if (newPin !== confirmNewPin) {
      alert("PIN yo pa menm. Tanpri re-eseye.");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', pin: newPin, type: 'transaction' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Erè');
      
      alert("PIN ou an anrejistre avèk siksè! Ou ka fè transfè kounye a.");
      setHasPin(true);
      setShowCreatePin(false);
    } catch (err: any) {
      alert("Erè nan kreyasyon PIN: " + err.message);
    } finally {
      setLoading(false);
    }
  };


  // 3. Lojik pou chache non moun nan otomatikman
  useEffect(() => {
    const findUser = async () => {
      if (email.includes('@') && email.length > 5) {
        setSearching(true);
        const { data, error } = await supabase.rpc('hatex_lookup_transfer_recipient', {
          p_email: email.toLowerCase().trim(),
        });

        if (!error && data?.found) {
          setReceiverName(data.full_name || null);
          setStatus({ type: '', msg: '' });
        } else {
          setReceiverName(null);
          if (data?.message && email.includes('@')) {
            setStatus({ type: 'error', msg: data.message });
          }
        }
        setSearching(false);
      } else {
        setReceiverName(null);
      }
    };

    const delay = setTimeout(findUser, 600);
    return () => clearTimeout(delay);
  }, [email, supabase]);

  // ==========================================
  // NOTIFYE ADMIN NAN (KÈS GLOBAL) LÈ YON FRÈ TRANSFÈ ANTRE
  // ==========================================
  const notifyAdminOfTransferFee = async (info: { senderEmail: string; receiverEmail: string; amount: number; fee: number }) => {
    const message =
      `🔁 <b>Frè Transfè P2P</b>\n` +
      `👤 Ekspeditè: ${info.senderEmail}\n` +
      `🎯 Benefisyè: ${info.receiverEmail}\n` +
      `💰 Montan Transfere: ${info.amount.toLocaleString()} HTG\n` +
      `✅ Frè ajoute otomatikman nan Kès Global: ${info.fee.toLocaleString()} HTG`;

    try {
      await fetch('/api/notifications/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'admin', message, parseMode: 'HTML' }),
      });
    } catch {
      // Si Telegram pa reponn, sa pa dwe bloke tranzaksyon an — frè a deja anrejistre nan baz done a
    }
  };

  // 4. KLIKE SOU BOUTON "KONFIME TRANSFÈ" (Sa ouvri bwat pou l mete PIN nan pito)
  const initiateTransfer = async () => {
    if (!kycApproved) {
      setStatus({ type: 'error', msg: 'Ou dwe pase KYC anvan ou ka fè transfè.' });
      return;
    }

    const amt = Number(amount);
    if (!receiverName || !amount || amt <= 0) return;

    if (amt < MIN_TRANSFER_AMOUNT) {
      setStatus({ type: 'error', msg: `Montan minimòm pou yon transfè se ${MIN_TRANSFER_AMOUNT} HTG.` });
      return;
    }
    if (amt > MAX_TRANSFER_AMOUNT) {
      setStatus({ type: 'error', msg: `Montan maksimòm pou yon sèl transfè se ${MAX_TRANSFER_AMOUNT.toLocaleString()} HTG.` });
      return;
    }

    const fee = getTransferFee(amt);
    if (walletBalance < amt + fee) {
      setStatus({ type: 'error', msg: `Ou pa gen ase kòb. Ou bezwen ${amt.toLocaleString()} HTG + ${fee.toLocaleString()} HTG (Frè) = ${(amt + fee).toLocaleString()} HTG.` });
      return;
    }

    // Limit jounalye/mansyèl pou kont endividyèl yo (Antrepriz ilimite)
    if (userId) {
      const limitCheck = await checkSpendingLimit(supabase, userId, accountType, amt, 'transfer');
      if (!limitCheck.allowed) {
        setStatus({ type: 'error', msg: `${limitCheck.message} Pase nan Kont Antrepriz pou transfè ilimite.` });
        return;
      }
    }

    setStatus({ type: '', msg: '' });
    setShowPinPrompt(true);
    setEnteredPin('');
  };

  // 5. VRE TRANZAKSYON AN APRE LI METE BON PIN NAN
  const executeTransfer = async () => {
    if (enteredPin.length !== 4) {
      setStatus({ type: 'error', msg: "PIN nan dwe gen 4 chif" });
      return;
    }

    setLoading(true);
    setStatus({ type: '', msg: '' });

    const amt = Number(amount);
    const fee = getTransferFee(amt);

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

      // Plafon balans destinatè a verifye ATOMIKMAN anndan RPC
      // `process_transfer_by_email` — pa bezwen li balans li depi navigatè a.
      const { error: rpcError } = await supabase.rpc('process_transfer_by_email', {
        p_sender_id: userId,
        p_receiver_email: email.toLowerCase().trim(),
        p_amount: amt,
        p_fee: fee,
      });
  
      if (rpcError) throw rpcError;

      if (fee > 0) {
        setWalletBalance(walletBalance - amt - fee);
        notifyAdminOfTransferFee({ senderEmail, receiverEmail: email.toLowerCase().trim(), amount: amt, fee });
      } else {
        setWalletBalance(walletBalance - amt);
      }

      setStatus({ type: 'success', msg: 'Transfè a reyisi!' });
      setShowPinPrompt(false); // Fèmen bwat PIN nan
      
      setAmount('');
      setEmail('');
      setReceiverName('');
      
      setTimeout(() => router.push('/dashboard'), 2000);
  
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
      setEnteredPin(''); // Netwaye fo kòd la pou l ka re-eseye
    } finally {
      setLoading(false);
    }
  };

  if (kycApproved === false) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-white border border-amber-200 rounded-3xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">KYC obligatwa pou transfè</h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Ou ka fè depo san KYC, men pou voye lajan bay lòt moun ou dwe verifye idantite w anvan.
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

  if (kycApproved === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 font-sans relative flex flex-col items-center">
      
      {/* ==================================================== */}
      {/* POPUP: KREYE PIN (Si l poko genyen l)                  */}
      {/* ==================================================== */}
      {showCreatePin && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 p-8 rounded-3xl w-full max-w-sm text-center shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
               <ShieldCheck className="text-indigo-600" size={28} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Kreye PIN Sekirite w</h2>
            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
              Ou dwe kreye yon kòd 4 chif pou pwoteje lajan w. L ap mande w li chak fwa w ap fè yon transfè.
            </p>
            
            <div className="space-y-4 mb-6">
              <input 
                type="password" maxLength={4} placeholder="ANTRE 4 CHIF" 
                value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full bg-slate-50 border border-gray-200 p-4 rounded-xl text-center text-xl font-mono tracking-[0.5em] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-900"
              />
              <input 
                type="password" maxLength={4} placeholder="KONFIME 4 CHIF YO" 
                value={confirmNewPin} onChange={(e) => setConfirmNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full bg-slate-50 border border-gray-200 p-4 rounded-xl text-center text-xl font-mono tracking-[0.5em] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-900"
              />
            </div>
            
            <button 
              onClick={handleCreatePin} disabled={loading || newPin.length !== 4 || confirmNewPin.length !== 4}
              className="w-full bg-indigo-600 hover:bg-indigo-700 py-4 rounded-xl font-bold uppercase text-xs text-white transition-all disabled:opacity-50 shadow-sm flex justify-center items-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Sove PIN nan"}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* POPUP: MANDE PIN POU KONFIME TRANZAKSYON AN          */}
      {/* ==================================================== */}
      {showPinPrompt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 p-8 rounded-3xl w-full max-w-sm text-center shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
               <Lock className="text-indigo-600" size={28} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Konfime Transfè a</h2>
            <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed">
              Mete PIN sekirite 4 chif ou a pou voye <span className="font-bold text-slate-800">{amount} HTG</span> bay <span className="font-bold text-slate-800">{receiverName?.split(' ')[0]}</span>
            </p>

            {Number(amount) > 0 && (
              <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 mb-6 text-left">
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-500">Montan:</span>
                  <span className="text-slate-800">{Number(amount).toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-500">Frè Transfè:</span>
                  <span className="text-rose-600">+{getTransferFee(Number(amount)).toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-gray-200 pt-2 mt-1.5">
                  <span>Total k ap soti nan Wallet ou:</span>
                  <span>{(Number(amount) + getTransferFee(Number(amount))).toLocaleString()} HTG</span>
                </div>
              </div>
            )}

            <input 
              type="password" maxLength={4} autoFocus placeholder="••••" 
              value={enteredPin} onChange={(e) => setEnteredPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-slate-50 border border-gray-200 p-4 rounded-xl text-center text-3xl font-mono tracking-[0.5em] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-6 text-slate-900 transition-all shadow-sm"
            />

            {status.msg && status.type === 'error' && (
               <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg mb-6">
                 <p className="text-xs text-rose-600 font-bold uppercase tracking-wider animate-pulse">{status.msg}</p>
               </div>
            )}
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowPinPrompt(false)} disabled={loading}
                className="flex-1 bg-white border border-gray-300 py-3.5 rounded-xl font-bold uppercase text-xs text-slate-700 hover:bg-gray-50 transition-all shadow-sm"
              >
                Anile
              </button>
              <button 
                onClick={executeTransfer} disabled={loading || enteredPin.length !== 4}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-3.5 rounded-xl font-bold uppercase text-xs text-white transition-all disabled:opacity-50 shadow-sm flex justify-center items-center"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Peye"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* PAJ NORMAL LA (Fòm Transfè a)                          */}
      {/* ==================================================== */}
      <div className={`w-full max-w-md transition-all duration-300 ${(showCreatePin || showPinPrompt) ? 'opacity-30 pointer-events-none blur-[2px]' : ''}`}>
        
        <div className="flex items-center gap-4 mb-8 mt-2">
          <button 
            onClick={() => router.back()} 
            className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Transfè P2P</h1>
            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">Frè Aplikab Selon Montan</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <ArrowRightLeft size={80} />
            </div>
            
            <label className="text-xs font-bold uppercase text-slate-500 mb-3 tracking-wider block">Email moun k ap resevwa a</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                {searching ? <Loader2 size={18} className="text-indigo-500 animate-spin" /> : <Search size={18} className="text-slate-400" />}
              </div>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="egzamp@gmail.com"
                className="bg-slate-50 border border-gray-200 text-sm font-medium w-full py-4 pl-12 pr-4 rounded-xl outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
              />
            </div>
          </div>

          {receiverName && (
            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl shadow-sm animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-50 shrink-0">
                   <User size={24} />
                 </div>
                 <div>
                    <p className="text-[10px] font-bold uppercase text-indigo-500 tracking-wider mb-1">Benefisyè HatexCard</p>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">{receiverName}</h2>
                 </div>
              </div>
            </div>
          )}

          <div className={`transition-all duration-500 ${receiverName ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm mb-6 text-center">
              <label className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-wider block">Montan pou voye (HTG)</label>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-transparent text-4xl sm:text-5xl font-bold w-full text-center outline-none border-b-2 border-gray-200 focus:border-indigo-600 pb-4 text-slate-900 placeholder:text-gray-300 transition-colors"
              />
              <p className="text-[10px] text-slate-400 font-medium mt-3 uppercase tracking-wider">
                Limit: {MIN_TRANSFER_AMOUNT.toLocaleString()} - {MAX_TRANSFER_AMOUNT.toLocaleString()} HTG pa tranzaksyon
              </p>
            </div>

            {Number(amount) > 0 && (
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-slate-500">Frè Transfè:</span>
                  <span className="text-rose-600">+{getTransferFee(Number(amount)).toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-gray-100 pt-2">
                  <span>Total k ap soti nan Wallet ou:</span>
                  <span>{(Number(amount) + getTransferFee(Number(amount))).toLocaleString()} HTG</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowFeeTable(v => !v)}
              className="w-full text-center text-[10px] text-indigo-600 font-bold uppercase tracking-wider mb-6"
            >
              {showFeeTable ? 'Kache Tablo Frè a ▲' : 'Wè Tablo Frè a ▼'}
            </button>

            {showFeeTable && (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
                <div className="grid grid-cols-3 bg-slate-900 text-white text-[10px] font-bold uppercase px-4 py-2.5">
                  <span>Minimòm</span>
                  <span>Maksimòm</span>
                  <span className="text-right">Frè</span>
                </div>
                {TRANSFER_FEE_TIERS.map(([min, max, fee], idx) => (
                  <div
                    key={`${min}-${max}`}
                    className={`grid grid-cols-3 text-xs font-medium px-4 py-2.5 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} text-slate-700`}
                  >
                    <span>{min.toLocaleString()}</span>
                    <span>{max.toLocaleString()}</span>
                    <span className="text-right font-bold">{fee === 0 ? 'Gratis' : `${fee} HTG`}</span>
                  </div>
                ))}
              </div>
            )}

            {status.msg && !showPinPrompt && (
              <div className={`mb-6 p-4 rounded-xl text-xs font-bold uppercase text-center flex items-center justify-center gap-2 ${status.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                {status.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                {status.msg}
              </div>
            )}

            <button 
              onClick={initiateTransfer}
              disabled={loading || !amount || Number(amount) <= 0}
              className={`w-full py-5 rounded-2xl font-bold uppercase text-xs tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 ${
                loading || !amount || Number(amount) <= 0
                ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed shadow-none' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md active:scale-[0.98]'
              }`}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <><ArrowRightLeft size={18} /> Konfime Transfè a</>}
            </button>
            <p className="text-center text-[10px] text-slate-400 font-medium mt-4 uppercase tracking-wider">
               Transfè ant itilizatè Hatexcard yo enstantane. Frè a depann de montan an.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}