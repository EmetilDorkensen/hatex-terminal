"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Rekipere done nan URL la
  const terminalId = searchParams.get('terminal');
  const amount = searchParams.get('amount');
  const cardNumber = searchParams.get('card_number');

  const processPayment = async () => {
    setStatus('processing');

    try {
      // 1. Rele yon RPC SQL pou verifye kat la epi fè transfè a
      const { data, error } = await supabase.rpc('process_terminal_payment', {
        p_terminal_id: terminalId,
        p_card_number: cardNumber,
        p_amount: parseFloat(amount || '0')
      });

      if (error) throw error;

      setStatus('success');
      // Tounen nan sit machann nan apre 3 segonn
      setTimeout(() => {
        window.location.href = document.referrer || '/dashboard';
      }, 3000);

    } catch (err: any) {
      alert(err.message);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center p-6 text-white italic">
      <div className="w-full max-w-md bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5 text-center">
        <h1 className="text-red-600 font-black uppercase tracking-widest mb-2">Hatex Secure Pay</h1>
        <p className="text-[10px] text-zinc-500 uppercase mb-8">Peman pou terminal: {terminalId?.substring(0,8)}...</p>
        
        <div className="mb-10">
          <p className="text-4xl font-black">{amount} HTG</p>
        </div>

        {status === 'idle' && (
          <button onClick={processPayment} className="w-full bg-red-600 py-6 rounded-2xl font-black uppercase">Peye Kounye a</button>
        )}

        {status === 'processing' && <div className="animate-pulse text-orange-500 font-black uppercase text-xs">Y ap verifye kat la...</div>}
        
        {status === 'success' && (
          <div className="text-green-500 font-black uppercase text-xs">
            ✅ Peman Reyisi! <br/> N ap redireksyon w...
          </div>
        )}
      </div>
    </div>
  );
}