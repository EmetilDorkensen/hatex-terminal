"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const amount = searchParams.get('amount');
  const id = searchParams.get('id');

  return (
    <div className="w-full max-w-md bg-zinc-900/80 p-10 rounded-[3rem] border border-white/10 text-center backdrop-blur-xl italic">
      <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 text-4xl mx-auto mb-6">
        ✓
      </div>
      <h1 className="text-white font-black uppercase text-2xl mb-2">Peman Reyisi!</h1>
      <p className="text-zinc-500 text-[10px] font-bold uppercase mb-8">Tranzaksyon ou an trete ak siksè</p>
      
      <div className="bg-black/40 p-6 rounded-2xl mb-8 border border-white/5">
        <p className="text-[9px] text-zinc-500 uppercase font-black">Montan Peye</p>
        <p className="text-3xl font-black text-white">{amount} <span className="text-sm text-red-600">HTG</span></p>
        <p className="text-[8px] text-zinc-700 mt-4 uppercase font-bold">ID: {id?.slice(0, 15)}...</p>
      </div>

      <button 
        onClick={() => router.push('/dashboard')}
        className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase text-[11px] hover:bg-zinc-200 transition-all"
      >
        Tounen nan Dashboard
      </button>
    </div>
  );
}

// Sa a se pati ki ranje erè Build la
export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center p-6 italic">
      <Suspense fallback={<div className="text-white font-black uppercase">Y ap chaje konfimasyon...</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}