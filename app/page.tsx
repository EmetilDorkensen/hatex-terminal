"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Konekte ak Supabase
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Konfime email ou!");
      }
      router.push('/dashboard');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center p-4 text-white font-sans italic">
      <div className="w-full max-w-md bg-zinc-900/50 p-8 rounded-[2.5rem] border border-zinc-800 shadow-2xl backdrop-blur-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-red-600 tracking-tighter">HATEXCARD</h1>
          <p className="text-zinc-500 text-[10px] uppercase font-bold mt-2 tracking-widest">
            {isLogin ? "Konekte sou kont ou" : "Kreye yon kont Hatex"}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleAuth}>
          <input 
            type="email" 
            placeholder="EMAIL" 
            className="w-full bg-black/40 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 text-sm transition-all" 
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
          <input 
            type="password" 
            placeholder="MODPAS" 
            className="w-full bg-black/40 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 text-sm transition-all" 
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 py-5 rounded-2xl font-black text-sm tracking-widest transition-all shadow-lg shadow-red-900/20 active:scale-95 disabled:opacity-50"
          >
            {loading ? "AP CHACHE..." : (isLogin ? "KONEKTE" : "KREYE KONT")}
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