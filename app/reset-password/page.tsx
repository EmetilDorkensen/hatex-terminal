"use client";

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMsg({ type: 'error', text: 'Lyen reyinisyalizasyon an pa valab oswa li ekspire.' });
          return;
        }
        window.history.replaceState({}, '', '/reset-password');
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMsg({ type: 'error', text: 'Ou dwe itilize lyen imèl reyinisyalizasyon an.' });
        return;
      }
      setReady(true);
    };
    init();
  }, [supabase]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'Modpas yo pa menm.' });
      return;
    }
    if (newPassword.length < 8) {
      setMsg({ type: 'error', text: 'Modpas la dwe gen omwen 8 karaktè.' });
      return;
    }

    setLoading(true);
    setMsg({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setMsg({ type: 'error', text: error.message });
      } else {
        setMsg({ type: 'success', text: 'Modpas ou chanje ak siksè! Ou ka konekte kounye a.' });
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
    } catch {
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

        {!ready && msg.text ? (
          <p className={`text-center text-xs font-bold ${msg.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{msg.text}</p>
        ) : (
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
                disabled={!ready}
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
                disabled={!ready}
              />
            </div>

            {msg.text && (
              <p className={`text-center text-[10px] font-bold ${msg.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{msg.text}</p>
            )}

            <button
              type="submit"
              disabled={loading || !ready}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white p-5 rounded-2xl font-black text-xs transition-all shadow-lg shadow-red-600/20 mt-4"
            >
              {loading ? 'AP TRETE...' : 'CHANJE MODPAS LA'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
