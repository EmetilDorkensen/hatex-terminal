"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    // Pou kounye a n ap voye l sou dashboard dirèkteman pou n teste si paj la parèt
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center p-4 text-white font-sans italic">
      <div className="w-full max-w-md bg-zinc-900/50 p-8 rounded-[2.5rem] border border-zinc-800 shadow-2xl backdrop-blur-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-red-600 tracking-tighter">HATEXCARD</h1>
          <p className="text-zinc-500 text-[10px] uppercase font-bold mt-2 tracking-widest">
            {isLogin ? "Byenvini ankò! Konekte sou kont ou." : "Kreye kont HatexCard ou kounye a."}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleAuth}>
          {!isLogin && (
            <input type="text" placeholder="NON KONPLÈ" className="w-full bg-black/40 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 text-sm" required />
          )}
          <input type="email" placeholder="EMAIL" className="w-full bg-black/40 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 text-sm" onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="MODPAS" className="w-full bg-black/40 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 text-sm" onChange={(e) => setPassword(e.target.value)} required />
          
          <button type="submit" className="w-full bg-red-600 hover:bg-red-700 py-5 rounded-2xl font-black text-sm tracking-widest transition-all shadow-lg shadow-red-900/20 active:scale-95">
            {isLogin ? "KONEKTE" : "KREYE KONT"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-tighter">
            {isLogin ? "Ou pako gen kont? Enskri la" : "Ou gen kont deja? Konekte"}
          </button>
        </div>
      </div>
    </div>
  );
}