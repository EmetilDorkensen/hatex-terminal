'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // Asire w chemen sa a bon

function SuccessContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    async function getDetails() {
      if (!id) return;
      // Nou chache enfòmasyon invoice la ak pwofil machann nan (owner_id)
      const { data } = await supabase
        .from('invoices')
        .select('*, profiles:owner_id(business_name, full_name)')
        .eq('id', id)
        .single();
      setDetails(data);
    }
    getDetails();
  }, [id]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-6 pt-12">
      <div id="receipt" className="bg-white text-black p-8 rounded-2xl max-w-sm w-full shadow-2xl mb-6">
        <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
          <h2 className="text-xl font-bold uppercase tracking-widest">Resi Peman</h2>
          <p className="text-sm text-gray-500">{new Date().toLocaleString()}</p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500">Machann:</span>
            <span className="font-bold">{details?.profiles?.business_name || details?.profiles?.full_name || '---'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Invoice ID:</span>
            <span className="font-mono text-xs">#{id?.slice(0, 12)}</span>
          </div>
          <hr className="border-gray-100" />
          <div className="flex justify-between items-center py-2">
            <span className="text-lg font-medium">TOTAL PEYE:</span>
            <span className="text-2xl font-black">{details?.amount} HTG</span>
          </div>
        </div>

        <div className="mt-8 text-center text-[10px] text-gray-400 uppercase italic">
          Mèsi paske ou itilize sèvis nou an!
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button 
          onClick={() => window.print()}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition"
        >
          📥 Telechaje Resi (PDF)
        </button>
        <button 
          onClick={() => window.location.href = '/'}
          className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl transition text-sm"
        >
          Retounen nan Dashboard
        </button>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; background: white !important; }
          #receipt, #receipt * { visibility: visible; }
          #receipt { position: absolute; left: 0; top: 0; width: 100%; border: none; }
        }
      `}</style>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Chajman...</div>}>
      <SuccessContent />
    </Suspense>
  );
}