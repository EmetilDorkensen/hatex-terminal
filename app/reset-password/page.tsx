"use client";
import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Konfigirasyon Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'Modpas yo pa menm.' });
      return;
    }

    setLoading(true);
    setMsg({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        setMsg({ type: 'error', text: error.message });
      } else {
        setMsg({ type: 'success', text: 'Modpas ou chanje ak siksè! Ou ka konekte kounye a.' });
        // Redirije apre 2 segonn
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Gen yon pwoblèm koneksyon.' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex flex-col items-center justify-center p-6 italic uppercase font-black">
      <div className="w-full max-w-md bg-zinc-900/30 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-md">
        
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-tighter italic text-red-600 mb-2">NOUVO MODPAS</h1>
          <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Chwazi yon modpas solid</p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="space-y-2 text-left">
            <label className="text-[8px] text-zinc-600 ml-2">NOUVO MODPAS</label>
            <input
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-black border border-white/5 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-bold text-xs text-white"
              required
            />
          </div>

          <div className="space-y-2 text-left">
            <label className="text-[8px] text-zinc-600 ml-2">KONFIME MODPAS LA</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            className="w-full bg-red-600 py-5 rounded-2xl font-black uppercase italic shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all text-sm mt-4 disabled:opacity-50 text-white"
          >
            {loading ? "AP ANREJISTRE..." : "CHANJE MODPAS LA"}
          </button>
        </form>
      </div>
    </div>
  );
}