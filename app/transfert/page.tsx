"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, User, ShieldCheck, ArrowRightLeft, Lock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

export default function TransferPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [receiverName, setReceiverName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

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
        const { data: profile } = await supabase
          .from('profiles')
          .select('transaction_pin')
          .eq('id', user.id)
          .single();
          
        if (!profile?.transaction_pin) {
          setHasPin(false);
          setShowCreatePin(true); // Fòse l kreye youn
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
      const { error } = await supabase
        .from('profiles')
        .update({ transaction_pin: newPin })
        .eq('id', userId);
        
      if (error) throw error;
      
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
        const { data, error } = await supabase.rpc('get_user_name_by_email', {
          p_email: email.toLowerCase().trim()
        });
        
        if (data) {
          setReceiverName(data);
          setStatus({ type: '', msg: '' });
        } else {
          setReceiverName(null);
        }
        setSearching(false);
      } else {
        setReceiverName(null);
      }
    };

    const delay = setTimeout(findUser, 600);
    return () => clearTimeout(delay);
  }, [email, supabase]);

  // 4. KLIKE SOU BOUTON "KONFIME TRANSFÈ" (Sa ouvri bwat pou l mete PIN nan pito)
  const initiateTransfer = () => {
    if (!receiverName || !amount || Number(amount) <= 0) return;
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
    
    try {
      // A) Nou verifye PIN nan dirèkteman nan baz done a anvan!
      const { data: profile } = await supabase
        .from('profiles')
        .select('transaction_pin')
        .eq('id', userId)
        .single();

      if (profile?.transaction_pin !== enteredPin) {
         throw new Error("PIN ou antre a pa bon. Tranzaksyon an anile.");
      }

      // B) Si PIN nan bon, nou pèmèt tranzaksyon an fèt
      const { error: rpcError } = await supabase.rpc('process_transfer_by_email', {
        p_sender_id: userId,
        p_receiver_email: email.toLowerCase().trim(),
        p_amount: Number(amount)
      });
  
      if (rpcError) throw rpcError;
  
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
            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
              Mete PIN sekirite 4 chif ou a pou voye <span className="font-bold text-slate-800">{amount} HTG</span> bay <span className="font-bold text-slate-800">{receiverName?.split(' ')[0]}</span>
            </p>
            
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
            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">Sèvis San Frè</p>
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
            </div>

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
               Transfè ant itilizatè Hatexcard yo gratis e enstantane.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}