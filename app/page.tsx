"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-md bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 shadow-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-red-600 italic">HATEXCARD</h1>
          <p className="text-gray-400 text-sm mt-2">
            {isLogin ? "Byenvini ankò! Konekte sou kont ou." : "Kreye kont HatexCard ou kounye a."}
          </p>
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); router.push('/dashboard'); }}>
          {!isLogin && (
            <input type="text" placeholder="Non konplè (Jan l parèt sou pyès ou)" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl outline-none focus:border-red-600" required />
          )}
          <input type="text" placeholder="Email oswa Telefòn" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl outline-none focus:border-red-600" required />
          <input type="password" placeholder="Modpas" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl outline-none focus:border-red-600" required />
          
          <button type="submit" className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-xl font-bold transition-all shadow-lg shadow-red-900/20">
            {isLogin ? "KONEKTE" : "KREYE KONT"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-gray-400 hover:text-white transition-colors">
            {isLogin ? "Ou pako gen kont? Enskri la" : "Ou gen kont deja? Konekte"}
          </button>
        </div>
      </div>
    </div>
  );
}