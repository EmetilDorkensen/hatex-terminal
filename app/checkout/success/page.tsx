"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle2, ShoppingBag, ShieldCheck, Hash, ArrowRight } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const amount = searchParams.get('amount') || "0";
  const transactionId = searchParams.get('id') || "TXN-000000";
  const orderId = searchParams.get('order_id') || "N/A";

  return (
    <div className="w-full max-w-[500px] bg-[#0d0e1a] p-10 md:p-14 rounded-[4rem] border border-white/5 shadow-2xl relative overflow-hidden italic text-white">
      
      {/* GLOW EFFECT */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-green-600/10 blur-[100px] rounded-full"></div>
      
      <div className="relative z-10 text-center">
        <div className="flex justify-center mb-8">
          <div className="bg-green-500/10 p-6 rounded-[2.5rem] border border-green-500/20 animate-in zoom-in duration-500">
            <CheckCircle2 className="text-green-500 w-16 h-16 stroke-[1.5px]" />
          </div>
        </div>

        <h1 className="text-4xl font-black uppercase tracking-tighter mb-2 italic">Merci ! ✅</h1>
        <p className="text-zinc-500 text-[10px] font-bold uppercase mb-12 tracking-[0.4em] opacity-60">Transaction complétée avec succès</p>

        {/* RECU BOX */}
        <div className="bg-zinc-900/40 p-10 rounded-[3rem] mb-10 border border-white/5 relative">
          <div className="flex justify-between items-center mb-8 pb-8 border-b border-white/5">
            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Montant Payé</span>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white italic">{parseFloat(amount).toLocaleString()}</span>
              <span className="text-xs font-black text-green-500 uppercase">HTG</span>
            </div>
          </div>
          
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-zinc-500">
                <ShieldCheck size={14} />
                <span className="text-[10px] font-black uppercase">Transaction ID</span>
              </div>
              <span className="text-[10px] font-mono text-white opacity-40">{transactionId}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-zinc-500">
                <Hash size={14} />
                <span className="text-[10px] font-black uppercase">Référence lòd</span>
              </div>
              <span className="text-[10px] font-black text-white">{orderId}</span>
            </div>
          </div>
        </div>

        {/* FOOTER MESSAGE */}
        <div className="bg-green-500/5 p-6 rounded-3xl border border-green-500/10 mb-10">
          <p className="text-[10px] text-green-500 font-bold uppercase leading-relaxed tracking-tight">
            Votre paiement a été vérifié. Les détails ont été enregistrés dans votre historique et celui du marchand. Un reçu électronique est en route.
          </p>
        </div>

        <button 
          onClick={() => router.push('/')}
          className="w-full bg-white text-black py-7 rounded-[2.2rem] font-black text-[12px] uppercase flex items-center justify-center gap-4 hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-2xl"
        >
          <ShoppingBag size={18} /> Retour au Portail
        </button>

        <p className="mt-14 text-[8px] text-zinc-800 font-black uppercase tracking-[0.6em] opacity-50">
          HatexCard Secure Gateway © 2026
        </p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center p-6 selection:bg-green-500/30">
      <Suspense fallback={<div className="text-green-500 font-black animate-pulse">FINALISATION...</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}