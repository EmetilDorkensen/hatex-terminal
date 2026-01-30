"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Lock, ShieldCheck, CreditCard, ArrowRight, AlertCircle } from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  
  // Rale enfòmasyon nan URL la
  const terminalId = searchParams.get('terminal');
  const amount = parseFloat(searchParams.get('amount') || '0');
  const [form, setForm] = useState({ name: '', card: '', cvv: '' });

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || !terminalId) {
      return setStatus({ type: 'error', msg: 'Tranzaksyon non valid.' });
    }

    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      // 1. Verifikasyon Sekirite Kat la
      const { data: card, error: cardErr } = await supabase
        .from('profiles')
        .select('id, card_balance, full_name, kyc_status, card_number')
        .eq('card_number', form.card.trim())
        .eq('cvv', form.cvv.trim())
        .single();

      if (cardErr || !card) throw new Error("Kat sa a pa valid nan sistèm nan.");
      if (card.full_name.toLowerCase() !== form.name.toLowerCase().trim()) throw new Error("Non ki sou kat la pa koresponn.");
      if (card.kyc_status !== 'approved') throw new Error("Kont sa a poko verifye (KYC).");
      if (Number(card.card_balance) < amount) throw new Error("Balans kat ou ensifizan pou montan sa a.");

      // 2. Egzekite Tranzaksyon an via RPC (SALE_SDK)
      const { data: res, error: payErr } = await supabase.rpc('process_sdk_payment', {
        p_terminal_id: terminalId,
        p_card_number: form.card.trim(),
        p_amount: amount
      });

      if (payErr) throw new Error(payErr.message);

      // 3. Siksè! Redirije
      router.push(`/checkout/success?amount=${amount}&id=${res.transaction_id || 'ok'}`);

    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-[#0d0e1a] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/10 blur-[100px]" />
      
      <div className="relative z-10">
        <div className="flex justify-center mb-6">
            <div className="bg-red-600/10 p-4 rounded-3xl border border-red-600/20">
                <ShieldCheck className="text-red-600 w-8 h-8" />
            </div>
        </div>

        <h1 className="text-center text-white font-black uppercase text-xl italic tracking-tighter mb-2">Hatex Secure Pay</h1>
        <p className="text-center text-zinc-500 text-[9px] font-bold uppercase mb-8 tracking-[0.2em]">Peman Sekirize 256-bit</p>
        
        <div className="bg-zinc-900/40 p-6 rounded-[2rem] mb-8 border border-white/5 text-center backdrop-blur-md">
          <p className="text-[10px] text-zinc-500 uppercase font-black mb-1">Montan pou Peye</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-4xl font-black italic text-white">{amount.toLocaleString()}</span>
            <span className="text-sm font-black text-red-600 italic mt-2">HTG</span>
          </div>
        </div>

        <form onSubmit={handlePayment} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[8px] text-zinc-600 font-black uppercase ml-4">Titilè Kat la</label>
            <input required placeholder="JAN PÒL" 
              className="w-full bg-zinc-900/50 border border-white/5 p-4 rounded-2xl text-[11px] outline-none focus:border-red-600/50 transition-all uppercase font-bold text-white"
              onChange={e => setForm({...form, name: e.target.value})} />
          </div>

          <div className="space-y-1">
            <label className="text-[8px] text-zinc-600 font-black uppercase ml-4">Nimewo Kat Hatex</label>
            <div className="relative">
                <input required placeholder="0000 0000 0000 0000" 
                    className="w-full bg-zinc-900/50 border border-white/5 p-4 rounded-2xl text-[11px] outline-none focus:border-red-600/50 transition-all text-white font-mono"
                    onChange={e => setForm({...form, card: e.target.value})} />
                <CreditCard className="absolute right-4 top-4 text-zinc-700 w-4 h-4" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                <label className="text-[8px] text-zinc-600 font-black uppercase ml-4">CVV</label>
                <input required type="password" maxLength={3} placeholder="***" 
                    className="w-full bg-zinc-900/50 border border-white/5 p-4 rounded-2xl text-[11px] outline-none focus:border-red-600/50 transition-all text-white text-center"
                    onChange={e => setForm({...form, cvv: e.target.value})} />
            </div>
            <div className="flex items-end">
                <div className="bg-zinc-900/20 p-4 rounded-2xl border border-white/5 w-full flex items-center justify-center">
                    <Lock className="text-zinc-700 w-4 h-4" />
                </div>
            </div>
          </div>

          <button disabled={loading} className="w-full bg-red-600 hover:bg-red-700 py-6 rounded-2xl font-black uppercase text-[11px] mt-4 shadow-[0_10px_40px_-10px_rgba(220,38,38,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3">
            {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
                <>Peye Kounye a <ArrowRight size={14} /></>
            )}
          </button>
        </form>

        {status.msg && (
          <div className="mt-6 p-4 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center gap-3 animate-in fade-in zoom-in">
            <AlertCircle className="text-red-500 w-4 h-4 flex-shrink-0" />
            <p className="text-red-500 text-[9px] font-black uppercase tracking-tighter leading-tight">
                {status.msg}
            </p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-center gap-4 grayscale opacity-30">
            <div className="text-[10px] font-black italic text-zinc-500">VISA</div>
            <div className="text-[10px] font-black italic text-zinc-500">MASTERCARD</div>
            <div className="text-[10px] font-black italic text-zinc-500">HATEX</div>
        </div>
      </div>
    </div>
  );
}

// PAJ PRENSIPAL LA AK SUSPENSE POU BUILD LA PA ECHWE
export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-[#06070d] text-white flex flex-col items-center justify-center p-6 italic font-sans selection:bg-red-600">
      <Suspense fallback={
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-red-600/10 border-t-red-600 rounded-full animate-spin" />
            <p className="text-[10px] font-black uppercase text-zinc-500 animate-pulse">Sekirite Hatex ap chaje...</p>
        </div>
      }>
        <CheckoutContent />
      </Suspense>
      
      <p className="mt-8 text-zinc-700 text-[8px] font-bold uppercase tracking-widest">
        © 2026 Hatex Technologies. All rights reserved.
      </p>
    </div>
  );
}