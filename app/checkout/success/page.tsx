"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, Suspense, useMemo } from 'react';
import { CheckCircle2, ShoppingBag, ArrowRight, Hash, ShieldCheck } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const amount = searchParams.get('amount') || "0.00";
  const transactionId = searchParams.get('id') || "TX-UNKNOWN";
  const orderId = searchParams.get('order_id') || "N/A";
  const invoiceId = searchParams.get('invoice_id');

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  useEffect(() => {
    const finalizeStatus = async () => {
      if (invoiceId && transactionId !== "TX-UNKNOWN") {
        await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId);
      }
    };
    finalizeStatus();
  }, [transactionId, invoiceId, supabase]);

  return (
    <div className="w-full max-w-[480px] bg-[#0d0e1a] p-10 md:p-12 rounded-[3.5rem] border border-white/5 shadow-2xl relative overflow-hidden font-sans italic text-white">
      
      {/* GLOW EFFECT (VÈ POU SIKSÈ) */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-green-600/10 blur-[100px] rounded-full"></div>
      
      <div className="relative z-10 text-center">
        {/* TI KROCHET VÈ A */}
        <div className="flex justify-center mb-8">
          <div className="bg-green-500/10 p-5 rounded-[2rem] border border-green-500/20 animate-in zoom-in duration-500">
            <CheckCircle2 className="text-green-500 w-12 h-12 stroke-[1.5px]" />
          </div>
        </div>

        <h1 className="text-3xl font-black uppercase tracking-tighter mb-2 italic">Paiement Réussi<span className="text-green-500">.</span></h1>
        <p className="text-zinc-500 text-[10px] font-bold uppercase mb-10 tracking-[0.2em] opacity-60">Transaction confirmée avec succès</p>

        {/* BOX REÇU (STYLE DARK) */}
        <div className="bg-zinc-900/40 p-8 rounded-[2.5rem] mb-8 border border-white/5 relative">
          <div className="flex justify-between items-center mb-6 pb-6 border-b border-white/5">
            <span className="text-[10px] font-black text-zinc-500 uppercase">Montant Transféré</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white italic">{parseFloat(amount).toLocaleString()}</span>
              <span className="text-xs font-black text-green-500">HTG</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck size={12} className="text-zinc-600" />
                <span className="text-[9px] font-black text-zinc-500 uppercase">ID Transaction</span>
              </div>
              <span className="text-[9px] font-mono text-white opacity-40">{transactionId.slice(0, 18)}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Hash size={12} className="text-zinc-600" />
                <span className="text-[9px] font-black text-zinc-500 uppercase">{invoiceId ? "Référence Invoice" : "Référence Commande"}</span>
              </div>
              <span className="text-[9px] font-black text-white">{invoiceId ? `#${invoiceId.slice(0,8)}` : `#${orderId}`}</span>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="space-y-4">
          <button 
            onClick={() => router.push('/dashboard')}
            className="w-full bg-white text-black py-6 rounded-[1.5rem] font-black text-[11px] uppercase flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-xl"
          >
            <ShoppingBag size={14} /> Retour au Dashboard
          </button>
          
          <div className="bg-green-500/5 p-4 rounded-2xl border border-green-500/10">
             <p className="text-[9px] text-green-500 font-black uppercase leading-relaxed">
               Un reçu électronique a été envoyé à votre adresse email. Gardez-le comme preuve de paiement.
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <p className="mt-12 text-[7px] text-zinc-800 font-black uppercase tracking-[0.5em]">Hatex Secure Network © 2026</p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center p-6 selection:bg-green-500/30">
      <Suspense fallback={
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-white/5 border-t-green-500 rounded-full animate-spin" />
          <p className="text-[9px] font-black text-zinc-500 uppercase italic tracking-widest">Finalisation...</p>
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </div>
  );
}