"use client";
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  
  const terminalId = searchParams.get('terminal');
  const amount = parseFloat(searchParams.get('amount') || '0');

  const [form, setForm] = useState({ name: '', card: '', cvv: '', exp: '' });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const validateAndPay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      // 1. VERIFIKASYON ENFÒMASYON KAT LA
      const { data: cardData, error: cardError } = await supabase
        .from('profiles')
        .select('id, card_balance, full_name, kyc_status')
        .eq('card_number', form.card.trim())
        .eq('cvv', form.cvv.trim())
        .single();

      // Chèk A: Eske kat la egziste?
      if (cardError || !cardData) {
        throw new Error("Kat sa a pa egziste nan sistèm nan.");
      }

      // Chèk B: Eske non ki sou kat la mache ak non ki tape a?
      if (cardData.full_name.toLowerCase() !== form.name.toLowerCase().trim()) {
        throw new Error("Non ki sou kat la pa koresponn ak non ou antre a.");
      }

      // Chèk C: Eske kat la aktif (KYC)?
      if (cardData.kyc_status !== 'approved') {
        throw new Error("Kat sa a bloke. Pwopriyetè a dwe pase KYC.");
      }

      // Chèk D: Eske kòb la ase?
      if (cardData.card_balance < amount) {
        throw new Error(`Balans ensifizan. Ou gen sèlman ${cardData.card_balance} HTG.`);
      }

      // 2. SI TOUT BAGAY OK, NOU RELE SQL LA POU FÈ TRANSFÈ A
      const { data: payRes, error: payErr } = await supabase.rpc('process_sdk_payment', {
        p_terminal_id: terminalId,
        p_card_number: form.card,
        p_cvv: form.cvv,
        p_amount: amount,
        p_payer_name: form.name
      });

      if (payErr || !payRes.success) throw new Error(payRes?.message || "Tranzaksyon echwe.");

      setStatus({ type: 'success', msg: `Peman ${amount} HTG reyisi! ✅` });
      
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex items-center justify-center p-6 italic">
      <div className="w-full max-w-md bg-zinc-900/80 p-10 rounded-[3rem] border border-white/10 backdrop-blur-xl shadow-2xl">
        <h1 className="text-center text-red-600 font-black uppercase text-xl mb-2 italic">Hatex Pay</h1>
        <p className="text-center text-[10px] text-zinc-500 font-bold mb-8 uppercase tracking-widest">Sekirite 256-bit AES</p>

        <div className="bg-black/40 p-6 rounded-2xl mb-8 border border-white/5 text-center">
          <p className="text-[9px] text-zinc-500 uppercase font-black">Montan pou Peye</p>
          <p className="text-3xl font-black italic">{amount.toLocaleString()} <span className="text-sm text-red-600">HTG</span></p>
        </div>

        <form onSubmit={validateAndPay} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase ml-2 text-zinc-500">Non sou kat la</label>
            <input required className="w-full bg-black/60 border border-white/5 p-4 rounded-xl text-[11px] outline-none focus:border-red-600" 
              placeholder="EX: JEAN BAKO" onChange={e => setForm({...form, name: e.target.value})} />
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase ml-2 text-zinc-500">Nimewo Kat</label>
            <input required className="w-full bg-black/60 border border-white/5 p-4 rounded-xl text-[11px] font-mono outline-none focus:border-red-600" 
              placeholder="**** **** **** ****" onChange={e => setForm({...form, card: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase ml-2 text-zinc-500">Ekspirasyon</label>
              <input required className="w-full bg-black/60 border border-white/5 p-4 rounded-xl text-[11px] outline-none" 
                placeholder="MM/AA" />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase ml-2 text-zinc-500">CVV</label>
              <input required className="w-full bg-black/60 border border-white/5 p-4 rounded-xl text-[11px] outline-none" 
                placeholder="***" onChange={e => setForm({...form, cvv: e.target.value})} />
            </div>
          </div>

          <button disabled={loading} className="w-full bg-red-600 py-6 rounded-2xl font-black uppercase text-[11px] mt-4 shadow-lg shadow-red-600/20 active:scale-95 transition-all">
            {loading ? "AP VERIFYE..." : "KONFIME PEMAN AN"}
          </button>
        </form>

        {status.msg && (
          <div className={`mt-6 p-4 rounded-xl text-center text-[9px] font-black uppercase border ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
            {status.msg}
          </div>
        )}
      </div>
    </div>
  );
}