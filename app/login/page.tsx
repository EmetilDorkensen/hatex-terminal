"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Konfigirasyon Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
        // Redirije itilizatè a nan dashboard
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setErrorMsg("Gen yon pwoblèm rezo, eseye ankò.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex flex-col items-center justify-center p-6 italic uppercase font-black">
      <div className="w-full max-w-md bg-zinc-900/30 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tighter italic text-red-600 mb-2 underline decoration-white/10">HatexCard</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">Koneksyon Sekirize</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2 text-left">
            <label className="text-[8px] text-zinc-600 ml-2">ADRÈS IMÈL</label>
            <input
              type="email"
              placeholder="MOUN@EMAIL.COM"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-white/5 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-bold text-xs"
              required
            />
          </div>

          <div className="space-y-2 text-left">
            <label className="text-[8px] text-zinc-600 ml-2">MODPAS</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-white/5 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-bold text-xs"
              required
            />
          </div>

          {errorMsg && (
            <div className="bg-red-600/10 border border-red-600/20 p-4 rounded-xl">
               <p className="text-red-500 text-[10px] font-black uppercase text-center">{errorMsg}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 py-5 rounded-2xl font-black uppercase italic shadow-lg shadow-red-600/20 active:scale-95 transition-all text-sm mt-4 disabled:opacity-50"
          >
            {loading ? "AP VERIFYE..." : "ANTRE NAN KONT MWEN"}
          </button>
        </form>

        <div className="mt-10 text-center space-y-4">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            Ou pa gen kont? <Link href="/signup" className="text-red-600 hover:text-white transition-colors">Kreye yon kont</Link>
          </p>
          <Link href="/forgot-password" title="Kontakte sipò">
            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest cursor-pointer hover:text-red-500">
                Mwen bliye modpas mwen
            </p>
          </Link>
        </div>
      </div>
      
      {/* Ti detay anba pou konfyans */}
      <div className="mt-8 flex items-center gap-3 opacity-20">
         <div className="h-[1px] w-12 bg-white"></div>
         <span className="text-[8px] tracking-[0.4em]">SECURED BY HATEX GROUP</span>
         <div className="h-[1px] w-12 bg-white"></div>
      </div>
    </div>
  );
}