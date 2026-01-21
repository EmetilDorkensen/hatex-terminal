"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Ranplase ak pwòp URL ak KEY ou ki nan dashboard Supabase ou
const supabaseUrl = 'https://your-project-url.supabase.co';
const supabaseKey = 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'success', text: 'Kont la kreye! Tcheke imèl ou.' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex flex-col justify-center items-center p-6 uppercase italic">
      <div className="w-full max-w-md bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-red-600 tracking-tighter mb-2">HATEXCARD</h1>
          <p className="text-zinc-500 text-[9px] font-bold tracking-widest">ENSKRIPSYON RAPID</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="text-[8px] font-black text-zinc-500 ml-2">IMÈL KLIYAN</label>
            <input 
              type="email" 
              placeholder="client@email.com" 
              className="w-full bg-black border border-white/10 p-4 rounded-2xl text-xs font-bold outline-none focus:border-red-600 transition-all"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-[8px] font-black text-zinc-500 ml-2">MODPAS</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full bg-black border border-white/10 p-4 rounded-2xl text-xs font-bold outline-none focus:border-red-600 transition-all"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {msg.text && (
            <div className={`p-4 rounded-xl text-[10px] font-black text-center ${msg.type === 'error' ? 'bg-red-600/10 text-red-500 border border-red-600/20' : 'bg-green-600/10 text-green-500 border border-green-600/20'}`}>
              {msg.text}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-red-600 py-5 rounded-2xl font-black text-xs shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {loading ? 'AP KREYE KONT...' : 'KREYE KONT'}
          </button>
        </form>

        <p className="text-center mt-8 text-[9px] font-bold text-zinc-500">
          OU GEN KONT DEJA? <Link href="/login" className="text-red-600 ml-1 hover:underline">KONEKTE LA</Link>
        </p>
      </div>
    </div>
  );
}