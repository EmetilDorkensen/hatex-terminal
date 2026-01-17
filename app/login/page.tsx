"use client";
import React, { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg("Email oswa Modpas pa bon. Verifye yo byen.");
        setLoading(false);
        return;
      }

      if (data?.user) {
        // NOUVO: Nou itilize window.location olye router.push 
        // pou asire Cookies yo fin ekri nèt anvan Dashboard la ouvri.
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setErrorMsg("Gen yon pwoblèm rezo, eseye ankò.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex flex-col items-center justify-center p-6 italic">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tighter italic text-red-600 mb-2">HatexCard</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">Koneksyon</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <input
              type="email"
              placeholder="EMAIL OU"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-bold uppercase text-xs"
              required
            />
          </div>

          <div className="space-y-2">
            <input
              type="password"
              placeholder="MODPAS"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-bold uppercase text-xs"
              required
            />
          </div>

          {errorMsg && (
            <p className="text-red-500 text-[10px] font-black uppercase text-center">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 py-5 rounded-2xl font-black uppercase italic shadow-lg shadow-red-600/20 active:scale-95 transition-all text-sm mt-4 disabled:opacity-50"
          >
            {loading ? "AP KONEKTE..." : "ANTRE NAN KONT MWEN"}
          </button>
        </form>

        <div className="mt-10 text-center space-y-4">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            Ou pa gen kont? <span className="text-white">Enskri w</span>
          </p>
          <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
            Mwen bliye modpas mwen
          </p>
        </div>
      </div>
    </div>
  );
}