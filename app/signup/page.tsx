"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Nou rale varyab yo dirèkteman
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    try {
      // 1. Enskri itilizatè a nan Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Sa a asire ke apre yo fin konfime imèl la, yo tounen sou sit la
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        setMsg({ 
          type: 'success', 
          text: 'Kont la kreye! Tanpri tcheke imèl ou pou konfime enskripsyon an.' 
        });
        // Si ou vle yo ale nan dashboard la dirèkteman si "Email Confirmation" dezaktive nan Supabase
        // window.location.href = '/dashboard';
      }

    } catch (error: any) {
      setMsg({ type: 'error', text: error.message || 'Gen yon erè ki rive.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex flex-col items-center justify-center p-6 italic uppercase font-black">
      <div className="w-full max-w-md bg-zinc-900/30 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-md">
        
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tighter italic text-red-600 mb-2 underline decoration-white/10">HatexCard</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold tracking-widest">KREYE YON KONT NOUVO</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2 text-left">
            <label className="text-[8px] text-zinc-600 ml-2">ADRÈS IMÈL (POU NOTIFIKASYON)</label>
            <input
              type="email"
              placeholder="CLIENT@EMAIL.COM"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-white/5 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-bold text-xs"
              required
            />
          </div>

          <div className="space-y-2 text-left">
            <label className="text-[8px] text-zinc-600 ml-2">MODPAS SEKIRIZE</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-white/5 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-bold text-xs"
              required
            />
          </div>

          {msg.text && (
            <div className={`p-4 rounded-xl border ${msg.type === 'error' ? 'bg-red-600/10 border-red-600/20 text-red-500' : 'bg-green-600/10 border-green-600/20 text-green-500'}`}>
               <p className="text-[10px] font-black uppercase text-center">{msg.text}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 py-5 rounded-2xl font-black uppercase italic shadow-lg shadow-red-600/20 active:scale-95 transition-all text-sm mt-4 disabled:opacity-50"
          >
            {loading ? "AP ANREJISTRE..." : "KREYE KONT MWEN"}
          </button>
        </form>

        <div className="mt-10 text-center">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            Ou gen yon kont deja? <Link href="/login" className="text-red-600 hover:text-white transition-colors">Konekte la</Link>
          </p>
        </div>
      </div>
      
      <div className="mt-8 flex items-center gap-3 opacity-20">
         <div className="h-[1px] w-12 bg-white"></div>
         <span className="text-[8px] tracking-[0.4em]">SECURED ENCRYPTION</span>
         <div className="h-[1px] w-12 bg-white"></div>
      </div>
    </div>
  );
}