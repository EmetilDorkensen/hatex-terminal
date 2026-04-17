"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

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
      
      alert("✅ PIN ou an anrejistre avek siksè! Ou ka fè transfè kounye a.");
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
         throw new Error("❌ PIN ou antre a pa bon. Tranzaksyon an anile.");
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
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans italic relative">
      
      {/* ==================================================== */}
      {/* POPUP: KREYE PIN (Si l poko genyen l)                  */}
      {/* ==================================================== */}
      {showCreatePin && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#121420] border border-red-600/30 p-8 rounded-[2.5rem] w-full max-w-sm text-center shadow-2xl shadow-red-900/20">
            <div className="text-4xl mb-4">🔐</div>
            <h2 className="text-xl font-black uppercase text-red-600 mb-2">Kreye PIN Sekirite w</h2>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-6">
              Ou dwe kreye yon kòd 4 chif pou pwoteje lajan w. L ap mande w li chak fwa w ap fè yon transfè.
            </p>
            
            <div className="space-y-4 mb-6">
              <input 
                type="password" maxLength={4} placeholder="ANTRE 4 CHIF" 
                value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full bg-black border border-white/10 p-4 rounded-2xl text-center text-xl font-black tracking-[1em] outline-none focus:border-red-600"
              />
              <input 
                type="password" maxLength={4} placeholder="KONFIME 4 CHIF YO" 
                value={confirmNewPin} onChange={(e) => setConfirmNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full bg-black border border-white/10 p-4 rounded-2xl text-center text-xl font-black tracking-[1em] outline-none focus:border-red-600"
              />
            </div>
            
            <button 
              onClick={handleCreatePin} disabled={loading || newPin.length !== 4 || confirmNewPin.length !== 4}
              className="w-full bg-red-600 py-4 rounded-2xl font-black uppercase active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? "AP SOVE..." : "SOVE PIN NAN"}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* POPUP: MANDE PIN POU KONFIME TRANZAKSYON AN          */}
      {/* ==================================================== */}
      {showPinPrompt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#121420] border border-white/10 p-8 rounded-[2.5rem] w-full max-w-sm text-center shadow-2xl">
            <h2 className="text-lg font-black uppercase text-white mb-2">Konfime Transfè a</h2>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-6">
              Mete PIN sekirite 4 chif ou a pou voye {amount} HTG bay {receiverName?.split(' ')[0]}
            </p>
            
            <input 
              type="password" maxLength={4} autoFocus placeholder="••••" 
              value={enteredPin} onChange={(e) => setEnteredPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-black border border-white/10 p-4 rounded-2xl text-center text-2xl font-black tracking-[1em] outline-none focus:border-red-600 mb-6 text-red-500"
            />

            {status.msg && status.type === 'error' && (
               <p className="text-[10px] text-red-500 font-black uppercase mb-4 animate-pulse">{status.msg}</p>
            )}
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowPinPrompt(false)} disabled={loading}
                className="flex-1 bg-zinc-800 py-4 rounded-2xl font-black uppercase text-[10px] text-white active:scale-95 transition-all"
              >
                ANILE
              </button>
              <button 
                onClick={executeTransfer} disabled={loading || enteredPin.length !== 4}
                className="flex-1 bg-red-600 py-4 rounded-2xl font-black uppercase text-[10px] text-white active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? "..." : "PEYE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* PAJ NORMAL LA (Fòm Transfè a)                          */}
      {/* ==================================================== */}
      <div className={`transition-all duration-300 ${(showCreatePin || showPinPrompt) ? 'opacity-30 pointer-events-none blur-sm' : ''}`}>
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 active:scale-90">
            <span className="text-xl">←</span>
          </button>
          <h1 className="text-lg font-black uppercase tracking-widest text-red-600">Transfè P2P</h1>
        </div>

        <div className="space-y-5">
          <div className="bg-zinc-900/40 p-6 rounded-[2rem] border border-white/5 transition-all">
            <p className="text-[10px] font-black uppercase text-zinc-500 mb-3 tracking-widest">Email moun k ap resevwa a</p>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="egzamp@gmail.com"
              className="bg-transparent text-lg font-bold w-full outline-none placeholder:text-zinc-800"
            />
            {searching && <div className="mt-2 text-[9px] text-red-600 animate-pulse font-black uppercase">Verifye baz de done...</div>}
          </div>

          {receiverName && (
            <div className="bg-red-600 p-6 rounded-[2.5rem] shadow-xl shadow-red-600/10 animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xl">👤</div>
                 <div>
                    <p className="text-[9px] font-black uppercase text-white/60 tracking-widest mb-1">Benefisyè HatexCard</p>
                    <h2 className="text-lg font-black uppercase tracking-tight">{receiverName}</h2>
                 </div>
              </div>
            </div>
          )}

          <div className={`transition-all duration-500 ${receiverName ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
            <div className="bg-zinc-900/40 p-6 rounded-[2rem] border border-white/5 mb-6 text-center">
              <p className="text-[10px] font-black uppercase text-zinc-500 mb-3 tracking-widest">Montan pou voye (HTG)</p>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-transparent text-5xl font-black w-full text-center outline-none placeholder:text-zinc-800"
              />
            </div>

            {status.msg && !showPinPrompt && (
              <div className={`mb-6 p-4 rounded-2xl text-[10px] font-black uppercase text-center ${status.type === 'error' ? 'bg-red-600/10 text-red-600' : 'bg-green-600/10 text-green-500'}`}>
                {status.msg}
              </div>
            )}

            <button 
              onClick={initiateTransfer}
              disabled={loading || !amount}
              className={`w-full py-8 rounded-[4rem] font-black uppercase italic tracking-widest transition-all ${
                loading ? 'bg-zinc-800 animate-pulse' : 'bg-white text-red-600 active:scale-95 shadow-xl shadow-white/5'
              }`}
            >
              KONFIME TRANSFÈ BAY {receiverName?.split(' ')[0]}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}