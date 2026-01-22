"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Konfigirasyon Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://hatexcard.com/reset-password',
          });

      if (error) {
        setMsg({ type: 'error', text: "Erè: Nou pa jwenn imèl sa a." });
      } else {
        setMsg({ type: 'success', text: "Nou voye yon lyen sou imèl ou pou w chanje modpas la." });
      }
    } catch (err) {
      setMsg({ type: 'error', text: "Gen yon pwoblèm koneksyon." });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex flex-col items-center justify-center p-6 italic uppercase font-black">
      <div className="w-full max-w-md bg-zinc-900/30 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-md relative overflow-hidden">
        
        {/* Dekorasyon background */}
        <div className="absolute top-0 right-0 w-20 h-20 bg-red-600/10 rounded-full blur-3xl"></div>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-tighter italic text-red-600 mb-2">MODPAS BLIYE</h1>
          <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold">N ap voye yon kòd sekirite pou ou</p>
        </div>

        <form onSubmit={handleReset} className="space-y-6">
          <div className="space-y-2 text-left">
            <label className="text-[8px] text-zinc-600 ml-2">ANTRE IMÈL OU TE ENSKRI A</label>
            <input
              type="email"
              placeholder="YOUR-EMAIL@GMAIL.COM"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-white/5 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-bold text-xs text-white"
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
            className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase italic shadow-lg hover:bg-red-600 hover:text-white transition-all text-sm disabled:opacity-50"
          >
            {loading ? "AP VOYE..." : "VOYE LYEN REKIPERASYON"}
          </button>
        </form>

        <div className="mt-10 text-center">
          <Link href="/login" className="text-[10px] text-zinc-500 font-black hover:text-red-600 transition-colors">
            ← TOUNEN NAN KONEKSYON
          </Link>
        </div>
      </div>
    </div>
  );
}