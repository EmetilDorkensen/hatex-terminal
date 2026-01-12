"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function RechajKatPage() {
  const [amount, setAmount] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Konfigirasyon Frè
  const FEE_RECHAJ = 10; // 10 HTG fiks pou chak rechaj (ou ka chanje l an %)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
    };
    fetchProfile();
  }, []);

  const totalDeduction = amount ? parseFloat(amount) + FEE_RECHAJ : 0;

  const handleTransfer = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (totalDeduction > profile.wallet_balance) {
      alert("Kòb sou Balans Prensipal ou pa ase!");
      return;
    }

    setLoading(true);

    // Rele fonksyon SQL pou transfere kòb la
    const { error } = await supabase.rpc('transfer_wallet_to_card', {
      user_id_input: profile.id,
      amount_input: parseFloat(amount),
      fee_input: FEE_RECHAJ
    });

    if (error) {
      alert("Erè nan transfè a: " + error.message);
    } else {
      alert("Kat ou rechaje ak siksè!");
      router.push('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6">
      <button onClick={() => router.back()} className="mb-8 text-zinc-500 font-black italic uppercase text-[10px]">← Tounen</button>
      
      <h1 className="text-3xl font-black italic uppercase mb-2 tracking-widest text-red-600">Rechaje Kat</h1>
      <p className="text-[10px] text-zinc-500 font-black uppercase mb-10 italic">Transfere kòb soti nan Wallet pou ale sou Kat</p>

      <div className="space-y-6">
        <div className="bg-zinc-900/40 p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden">
          <div className="flex justify-between mb-4">
             <span className="text-[10px] font-black text-zinc-500 uppercase">Disponib:</span>
             <span className="text-[10px] font-black text-white italic">{profile?.wallet_balance?.toLocaleString()} HTG</span>
          </div>
          
          <input 
            type="number" 
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="bg-transparent text-5xl font-black italic w-full outline-none border-b border-zinc-800 pb-4 focus:border-red-600 transition-all mb-6"
          />

          <div className="space-y-2 border-t border-white/5 pt-4">
             <div className="flex justify-between text-[10px] font-black uppercase italic">
                <span className="text-zinc-500">Frè sèvis:</span>
                <span>{FEE_RECHAJ} HTG</span>
             </div>
             <div className="flex justify-between text-sm font-black uppercase italic text-red-600">
                <span>Total k'ap soti:</span>
                <span>{totalDeduction} HTG</span>
             </div>
          </div>
        </div>

        <button 
          onClick={handleTransfer}
          disabled={loading || !amount}
          className="w-full bg-white text-black py-6 rounded-[2.5rem] font-black uppercase italic text-sm shadow-2xl active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? "Ap pwogrese..." : "Konfime Rechaj"}
        </button>
      </div>
    </div>
  );
}