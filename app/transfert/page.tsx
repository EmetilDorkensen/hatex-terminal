"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function TransferPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [receiverName, setReceiverName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Lojik pou chache non moun nan otomatikman
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
  }, [email]);

// Ranplase fonksyon handleTransfer la ak sa a:
const handleTransfer = async () => {
  if (!receiverName || !amount || Number(amount) <= 0) return;
  setLoading(true);
  
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // 1. Egzekite Transfè a nan Balans yo
    const { data: receiverId, error: rpcError } = await supabase.rpc('process_transfer_by_email', {
      p_sender_id: user.id,
      p_receiver_email: email.toLowerCase().trim(),
      p_amount: Number(amount)
    });

    if (rpcError) {
      setStatus({ type: 'error', msg: rpcError.message });
    } else {
      // 2. Anrejistre pou moun ki VOYE a (Sender)
      await supabase.from('transactions').insert({
        user_id: user.id,
        amount: -Number(amount), // Negatif paske kòb la soti
        type: 'P2P',
        description: `Voye bay ${receiverName}`,
        sender_email: user.email,
        status: 'success',
        method: 'WALLET'
      });

      // 3. Anrejistre pou moun ki RESEVWA a (Receiver)
      // Nòt: receiverId dwe retounen pa RPC a oswa ou dwe chache l
      if (receiverId) {
        await supabase.from('transactions').insert({
          user_id: receiverId,
          amount: Number(amount), // Pozitif paske li resevwa
          type: 'P2P',
          description: `Resevwa nan men yon zanmi`,
          receiver_email: email.toLowerCase().trim(), // MOUN K AP RESEVWA A
          status: 'success',
          method: 'WALLET'
        });
      }

      setStatus({ type: 'success', msg: 'Transfè a reyisi!' });
      setTimeout(() => router.push('/dashboard'), 2000);
    }
  }
  setLoading(false);
};

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans italic">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 active:scale-90">
          <span className="text-xl">←</span>
        </button>
        <h1 className="text-lg font-black uppercase tracking-widest text-red-600">Transfè</h1>
      </div>

      <div className="space-y-5">
        {/* BLÒK EMAIL */}
        <div className="bg-zinc-900/40 p-6 rounded-[2rem] border border-white/5 transition-all">
          <p className="text-[10px] font-black uppercase text-zinc-500 mb-3 tracking-widest">Email moun nan</p>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="egzamp@gmail.com"
            className="bg-transparent text-lg font-bold w-full outline-none placeholder:text-zinc-800"
          />
          {searching && <div className="mt-2 text-[9px] text-red-600 animate-pulse font-black uppercase">Y ap verifye...</div>}
        </div>

        {/* KAT KONFIMASYON NON (Parèt sèlman si email la bon) */}
        {receiverName && (
          <div className="bg-red-600 p-6 rounded-[2.5rem] shadow-xl shadow-red-600/10 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xl">👤</div>
               <div>
                  <p className="text-[9px] font-black uppercase text-white/60 tracking-widest leading-none mb-1">Benefisyè verifye</p>
                  <h2 className="text-lg font-black uppercase tracking-tight">{receiverName}</h2>
               </div>
            </div>
          </div>
        )}

        {/* BLÒK MONTAN (Parèt apre verifye moun nan) */}
        <div className={`transition-all duration-500 ${receiverName ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
          <div className="bg-zinc-900/40 p-6 rounded-[2rem] border border-white/5 mb-6">
            <p className="text-[10px] font-black uppercase text-zinc-500 mb-3 tracking-widest text-center">Montan pou voye (HTG)</p>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-transparent text-5xl font-black w-full text-center outline-none placeholder:text-zinc-800"
            />
          </div>

          {status.msg && (
            <div className={`mb-6 p-4 rounded-2xl text-[10px] font-black uppercase text-center ${status.type === 'error' ? 'bg-red-600/10 text-red-600' : 'bg-green-600/10 text-green-500'}`}>
              {status.msg}
            </div>
          )}

          <button 
            onClick={handleTransfer}
            disabled={loading || !amount}
            className={`w-full py-8 rounded-[4rem] font-black uppercase italic tracking-widest transition-all ${
              loading ? 'bg-zinc-800' : 'bg-white text-red-600 active:scale-95 shadow-xl shadow-white/5'
            }`}
          >
            {loading ? 'Y ap voye...' : `Voye bay ${receiverName?.split(' ')[0]}`}
          </button>
        </div>
      </div>
    </div>
  );
}