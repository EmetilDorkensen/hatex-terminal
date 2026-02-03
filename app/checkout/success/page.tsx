"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, Suspense, useState } from 'react';
import { CheckCircle2, ShoppingBag, ArrowRight } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Rale enfòmasyon dinamik yo
  const amount = searchParams.get('amount') || "0.00";
  const transactionId = searchParams.get('id') || "TX-UNKNOWN";
  const orderId = searchParams.get('order_id') || "N/A";
  const invoiceId = searchParams.get('invoice_id'); // Detekte si se yon invoice

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const notifyBusiness = async () => {
      try {
        // 1. Notifye webhook biznis la (pou SDK)
        await fetch("https://sit-biznis-kliyan-an.com/api/hatex-webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amount,
            order_details: `Commande #${orderId}`,
            status: "SUCCESS"
          })
        });

        // 2. Si se te yon invoice, nou asire nou li make "paid" (double check)
        if (invoiceId) {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId);
        }
      } catch (err) {
        console.error("Webhook failed");
      }
    };

    if (transactionId !== "TX-UNKNOWN") {
      notifyBusiness();
    }
  }, [transactionId, invoiceId, amount, orderId, supabase]);

  return (
    <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 text-center relative overflow-hidden">
      {/* Dekorasyon vèt nan background nan */}
      <div className="absolute top-0 left-0 w-full h-2 bg-green-500" />
      
      <div className="flex justify-center mb-6">
        <div className="bg-green-50 p-4 rounded-full">
          <CheckCircle2 className="text-green-500 w-12 h-12 animate-bounce" />
        </div>
      </div>

      <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight mb-2">Paiement Réussi !</h1>
      <p className="text-gray-400 text-xs font-medium uppercase mb-8">Merci pour votre achat sur HatexCard</p>

      <div className="bg-gray-50 rounded-3xl p-6 mb-8 border border-gray-100">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200/50">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Montant Payé</span>
          <span className="text-xl font-black text-gray-900">{amount} <span className="text-sm">HTG</span></span>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between text-[10px] font-bold uppercase">
            <span className="text-gray-400">ID Transaction</span>
            <span className="text-gray-900 font-mono">{transactionId.slice(0, 12)}...</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold uppercase">
            <span className="text-gray-400">{invoiceId ? "Numéro Invoice" : "Numéro Commande"}</span>
            <span className="text-gray-900">{invoiceId ? `#${invoiceId.slice(0,8)}` : `#${orderId}`}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button 
          onClick={() => router.push('/dashboard')}
          className="w-full bg-gray-900 text-white py-5 rounded-2xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-gray-200"
        >
          <ShoppingBag size={14} /> Retour au Dashboard
        </button>
        
        <p className="text-[9px] text-gray-400 font-bold uppercase animate-pulse">
          Un reçu a été envoyé à votre adresse email
        </p>
      </div>
    </div>
  );
}

// PWOTEKSYON SUSPENSE POU BUILD LA PASSE
export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-6 font-sans">
      <Suspense fallback={
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin" />
          <p className="text-[10px] font-bold text-gray-400 uppercase italic">Finalisation de la commande...</p>
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </div>
  );
}