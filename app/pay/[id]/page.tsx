"use client";
import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function PublicPaymentPage({ params }: { params: { id: string } }) {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  useEffect(() => {
    const getInvoice = async () => {
      const { data } = await supabase.from('invoices').select('*').eq('id', params.id).single();
      setInvoice(data);
    };
    getInvoice();
  }, [params.id]);

  const handlePayment = async () => {
    setLoading(true);
    // Simulation verifikasyon kat HATEX
    setTimeout(async () => {
      await supabase.from('invoices').update({ status: 'paid' }).eq('id', params.id);
      alert("Peman Reyisi ak Kat HATEX!");
      setLoading(false);
    }, 2000);
  };

  if (!invoice) return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center text-white italic">Y ap chèche invoice la...</div>;

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-zinc-900/50 p-8 rounded-[3rem] border border-red-600/20 text-center space-y-6">
        <img src="/logo-hatex.png" className="w-12 mx-auto mb-4" alt="Hatex" />
        <h2 className="text-xs font-black uppercase text-zinc-500">Peman Sekirize Hatex</h2>
        <div className="text-4xl font-black text-red-600">{invoice.amount} HTG</div>
        <p className="text-[10px] uppercase text-zinc-400">Pou: {invoice.client_email}</p>
        
        <div className="space-y-3 pt-4">
          <input type="text" placeholder="NIMEWO KAT HATEX" className="w-full bg-black/40 p-4 rounded-xl border border-white/5 outline-none text-center font-mono" />
          <div className="flex gap-2">
            <input type="text" placeholder="MM/YY" className="w-1/2 bg-black/40 p-4 rounded-xl border border-white/5 outline-none text-center" />
            <input type="text" placeholder="CVC" className="w-1/2 bg-black/40 p-4 rounded-xl border border-white/5 outline-none text-center" />
          </div>
        </div>

        <button onClick={handlePayment} disabled={loading || invoice.status === 'paid'} className="w-full bg-red-600 py-5 rounded-2xl font-black uppercase text-[10px] mt-4">
          {invoice.status === 'paid' ? 'DEJA PEYE' : loading ? 'VERIFIKASYON...' : 'PEYE KOUNYE A'}
        </button>
      </div>
    </div>
  );
}