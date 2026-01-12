"use client";
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchDeposits();
  }, []);

  const fetchDeposits = async () => {
    // Nou rale depo yo ak tout enfòmasyon pwofil kliyan an
    const { data } = await supabase
      .from('deposits')
      .select(`*, profiles(full_name, wallet_balance)`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setDeposits(data || []);
  };

  const handleApprove = async (dep: any) => {
    const confirmApprove = confirm(`Apwouve ${dep.amount} HTG pou ${dep.profiles.full_name}?`);
    if (!confirmApprove) return;

    // 1. Mete kòb la sou wallet kliyan an
    const { error: updateError } = await supabase.rpc('confirm_deposit_manual', {
      p_user_id: dep.user_id,
      p_amount: dep.amount,
      p_deposit_id: dep.id
    });

    if (!updateError) {
      alert("Depo Apwouve!");
      fetchDeposits();
    } else {
      alert("Erè: " + updateError.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-sans italic">
      <div className="flex justify-between items-end mb-10 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-2xl font-black text-red-600 uppercase">Admin: Depo Manyèl</h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Verifye prèv peman yo isit la</p>
        </div>
        <div className="text-right">
          <span className="text-4xl font-black">{deposits.length}</span>
          <p className="text-[8px] text-zinc-600 uppercase">Demann an atant</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {deposits.map((dep) => (
          <div key={dep.id} className="bg-zinc-900/50 border border-white/5 p-6 rounded-[2.5rem] flex flex-col md:flex-row gap-6">
            {/* Foto Prèv yo */}
            <div className="flex gap-2">
              <div className="w-24 h-32 bg-zinc-800 rounded-xl overflow-hidden border border-white/10">
                <img src={dep.proof_img_1} alt="Prèv 1" className="w-full h-full object-cover" />
              </div>
              <div className="w-24 h-32 bg-zinc-800 rounded-xl overflow-hidden border border-white/10">
                <img src={dep.proof_img_2} alt="Prèv 2" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Enfòmasyon */}
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <h2 className="font-black uppercase text-sm">{dep.profiles?.full_name || 'Kliyan Enkoni'}</h2>
                <span className="text-[10px] bg-red-600/20 text-red-500 px-3 py-1 rounded-full font-bold">{dep.method}</span>
              </div>
              <p className="text-[9px] text-zinc-500 font-mono uppercase">ID Kliyan: {dep.user_id}</p>
              <p className="text-[9px] text-zinc-500 font-mono uppercase">TXN ID: {dep.transaction_id}</p>
              
              <div className="pt-4 flex items-center gap-4">
                <div>
                  <p className="text-[8px] text-zinc-600 uppercase">Montan pou voye</p>
                  <p className="text-xl font-black text-green-500">{dep.amount} HTG</p>
                </div>
                <div className="border-l border-white/5 pl-4">
                  <p className="text-[8px] text-zinc-600 uppercase">Kliyan an te peye (+frais)</p>
                  <p className="text-sm font-bold text-white">{dep.total_to_pay} HTG</p>
                </div>
              </div>
            </div>

            {/* Aksyon */}
            <div className="flex flex-col justify-center gap-2">
              <button onClick={() => handleApprove(dep)} className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] transition-all">Apwouve</button>
              <button className="bg-zinc-800 hover:bg-red-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] transition-all">Rejte</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
