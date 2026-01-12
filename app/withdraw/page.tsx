"use client";
import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function WithdrawPage() {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(0);
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('MonCash');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Kalkil frè (egzanp: 5%)
  const withdrawFee = amount * 0.05;
  const netAmount = amount - withdrawFee;

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
    };
    fetchProfile();
  }, [supabase]);

  const handleSubmit = async () => {
    if (amount < 500) return alert("Minimòm retrè se 500 HTG");
    if (amount > (profile?.wallet_balance || 0)) return alert("Ou pa gen ase kòb");
    if (!phone) return alert("Mete nimewo telefòn ou");

    setLoading(true);
    try {
      const { error } = await supabase.from('withdrawals').insert([{
        user_id: profile.id,
        amount: amount,
        fee: withdrawFee, // Nou anrejistre frè a
        net_amount: netAmount, // Sa pou w voye ba li vre a
        method: method,
        phone: phone,
        status: 'pending'
      }]);

      if (error) throw error;

      const BOT_TOKEN = '8395029585:AAEZKtLVQhuwk8drzziAIJeDtHuhjl77bPY';
      const CHAT_ID = '8392894841';
      const msg = `💸 *DEMANN RETRÈ*\n👤: ${profile.full_name}\n💰 Brits: ${amount} HTG\n📉 Frè (5%): ${withdrawFee} HTG\n✅ Nèt pou voye: ${netAmount} HTG\n📲: ${method} (${phone})`;
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown' })
      });

      alert("Demann voye! N ap trete l nan 15-45 minit.");
      router.push('/dashboard');
    } catch (err: any) {
      alert("Erè: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans italic">
      <h1 className="text-xl font-black uppercase text-red-600 mb-8">Retire Fon</h1>
      <div className="space-y-6">
        <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5">
            <p className="text-[10px] text-center mb-4 text-zinc-500 uppercase italic">Balans: {profile?.wallet_balance || 0} HTG</p>
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full bg-transparent text-4xl font-black text-center outline-none" placeholder="0" />
            
            {amount > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5 text-[10px] uppercase space-y-1">
                <div className="flex justify-between text-zinc-500"><span>Frè Sèvis (5%):</span><span>-{withdrawFee.toFixed(2)} HTG</span></div>
                <div className="flex justify-between font-black text-green-500"><span>W ap resevwa:</span><span>{netAmount.toFixed(2)} HTG</span></div>
              </div>
            )}
        </div>
        
        <div className="bg-zinc-900 p-6 rounded-[2rem] border border-white/5 space-y-4">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full bg-black p-4 rounded-xl border border-white/5 text-xs font-black italic">
                <option value="MonCash">MonCash</option>
                <option value="NatCash">NatCash</option>
            </select>
            <input type="text" placeholder="NIMEWO TELEFÒN" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-black/40 p-4 rounded-xl outline-none border border-white/5 text-xs font-black italic" />
        </div>

        <button onClick={handleSubmit} disabled={loading} className="w-full bg-red-600 py-6 rounded-full font-black uppercase text-sm shadow-lg shadow-red-600/20">
          {loading ? 'Y ap voye...' : 'Konfime Retrè'}
        </button>
      </div>
    </div>
  );
}