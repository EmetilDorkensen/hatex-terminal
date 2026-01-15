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

  // Kalkil frè (5%)
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
      // 1. RETIRE KÒB LA NAN BALANS KLIYAN AN AVAN
      const nouvoBalans = profile.wallet_balance - amount;
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ wallet_balance: nouvoBalans })
        .eq('id', profile.id);

      if (balanceError) throw new Error("Erè nan mizajou balans");

      // 2. ANREJISTRE DEMANN RETRÈ A
      const { error: withdrawError } = await supabase.from('withdrawals').insert([{
        user_id: profile.id,
        amount: amount,
        fee: withdrawFee,
        net_amount: netAmount,
        method: method,
        phone: phone,
        status: 'pending'
      }]);

      if (withdrawError) {
        // SI GEN ERÈ ISIT LA, NOU REMÈT KLIYAN AN KÒB LI SOU BALANS LAN
        await supabase.from('profiles').update({ wallet_balance: profile.wallet_balance }).eq('id', profile.id);
        throw new Error("Erè nan anrejistreman retrè");
      }

      // 3. VOYE NOTIFIKASYON TELEGRAM
      const BOT_TOKEN = '8395029585:AAEZKtLVQhuwk8drzziAIJeDtHuhjl77bPY';
      const CHAT_ID = '8392894841';
      const msg = `💸 *DEMANN RETRÈ NOUVO*\n\n👤: ${profile.full_name}\n💰 Brits: ${amount} HTG\n📉 Frè (5%): ${withdrawFee} HTG\n✅ Nèt pou voye: ${netAmount} HTG\n📲: ${method} (${phone})\n\n_Kòb la deja retire sou balans kliyan an_`;
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown' })
      });

      alert("Retrè voye! Kòb la retire sou balans ou. N ap voye l nan 15-45 minit.");
      router.push('/dashboard');

    } catch (err: any) {
      alert("Erè: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans italic">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-white/5">←</button>
        <h1 className="text-xl font-black uppercase text-red-600">Retire Fon</h1>
      </div>

      <div className="space-y-6">
        <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
            <p className="text-[10px] text-center mb-4 text-zinc-500 uppercase font-black tracking-widest">Balans ou: {profile?.wallet_balance?.toLocaleString() || 0} HTG</p>
            <div className="flex items-center justify-center gap-2">
               <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full bg-transparent text-5xl font-black text-center outline-none text-white" placeholder="0" />
            </div>
            
            {amount > 0 && (
              <div className="mt-6 pt-6 border-t border-white/5 text-[10px] uppercase space-y-2">
                <div className="flex justify-between text-zinc-500"><span>Frè Hatex (5%):</span><span className="font-bold">-{withdrawFee.toFixed(2)} HTG</span></div>
                <div className="flex justify-between font-black text-red-500 text-sm"><span>Nèt pou resevwa:</span><span>{netAmount.toFixed(2)} HTG</span></div>
              </div>
            )}
        </div>
        
        <div className="bg-zinc-900 p-6 rounded-[2rem] border border-white/5 space-y-4">
            <label className="text-[9px] font-black text-zinc-500 uppercase ml-2">Metòd Pèman</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full bg-black/50 p-5 rounded-2xl border border-white/5 text-xs font-black italic outline-none">
                <option value="MonCash">MonCash</option>
                <option value="NatCash">NatCash</option>
            </select>
            
            <label className="text-[9px] font-black text-zinc-500 uppercase ml-2">Nimewo Kont / Telefòn</label>
            <input type="text" placeholder="EG: 44332211" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-black/50 p-5 rounded-2xl outline-none border border-white/5 text-xs font-black italic" />
        </div>

        <button 
          onClick={handleSubmit} 
          disabled={loading || amount <= 0} 
          className={`w-full py-6 rounded-full font-black uppercase text-sm transition-all shadow-xl ${loading ? 'bg-zinc-800 opacity-50' : 'bg-red-600 active:scale-95 shadow-red-600/20'}`}
        >
          {loading ? 'Y ap trete demann lan...' : 'Konfime ak Retire'}
        </button>

        <p className="text-[9px] text-center text-zinc-600 uppercase font-bold leading-relaxed">
          Lè w klike sou bouton an, kòb la ap retire otomatikman <br/> sou balans Hatex ou a.
        </p>
      </div>
    </div>
  );
}