"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useRef } from 'react';
import html2canvas from 'html2canvas';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const receiptRef = useRef(null);

  const amount = searchParams.get('amount');
  const transactionId = searchParams.get('id');
  const date = new Date().toLocaleString();

  const downloadReceipt = async () => {
    if (receiptRef.current) {
      const canvas = await html2canvas(receiptRef.current);
      const link = document.createElement('a');
      link.download = `Hatex-Receipt-${transactionId}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex flex-col items-center justify-center p-6 italic">
      {/* RESI A (SA N AP KONVÈTI AN FOTO A) */}
      <div ref={receiptRef} className="w-full max-w-sm bg-white text-black p-8 rounded-[2rem] shadow-2xl mb-8">
        <div className="text-center border-b border-dashed border-zinc-300 pb-6">
          <h2 className="font-black text-2xl uppercase italic tracking-tighter text-red-600">HatexPay</h2>
          <p className="text-[9px] font-bold text-zinc-500 uppercase">Resi Tranzaksyon Ofisyèl</p>
        </div>
        
        <div className="py-8 space-y-4">
          <div className="flex justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Montan:</span>
            <span className="font-black text-lg">{amount} HTG</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Tranzaksyon:</span>
            <span className="font-mono text-[9px]">#HTX-{transactionId?.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Dat:</span>
            <span className="text-[10px] font-bold">{date}</span>
          </div>
          <div className="flex justify-center pt-4">
            <div className="bg-green-100 text-green-700 px-4 py-1 rounded-full text-[10px] font-black uppercase">
              Peman Reyisi ✅
            </div>
          </div>
        </div>

        <div className="text-center border-t border-dashed border-zinc-300 pt-6">
          <p className="text-[8px] text-zinc-400 font-bold uppercase">Mèsi paske ou itilize HatexCard</p>
        </div>
      </div>

      {/* BOUTON YO */}
      <div className="w-full max-w-sm space-y-4">
        <button onClick={downloadReceipt} className="w-full bg-zinc-900 border border-white/10 py-5 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-3 active:scale-95 transition-all">
          <span>📸</span> Telechaje Resi a
        </button>
        <button onClick={() => window.location.href = '/'} className="w-full bg-red-600 py-5 rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">
          Tounen sou Sit la
        </button>
      </div>
    </div>
  );
}