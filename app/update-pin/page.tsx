"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, ArrowLeft } from 'lucide-react';

export default function UpdatePinPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      setLoading(false);
    }
    checkUser();
  }, [router, supabase]);

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPin.length !== 4 || confirmPin.length !== 4) {
      setError("PIN lan dwe gen egzakteman 4 chif.");
      return;
    }

    if (newPin !== confirmPin) {
      setError("PIN yo pa koresponn. Tanpri verifye yo.");
      return;
    }

    setIsSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          pin_code: newPin, 
          pin_enabled: true, 
          failed_pin_attempts: 0, 
          account_status: 'active' // Debloke kont lan otomatikman si l te bloke
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setMessage("✅ PIN ou an chanje avèk siksè!");
      setTimeout(() => {
        router.push('/setting');
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Te gen yon pwoblèm. Eseye ankò.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white flex flex-col items-center justify-center p-6 italic font-medium selection:bg-red-600">
      <div className="w-full max-w-md bg-zinc-900/30 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-md">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-all tracking-[0.3em] mb-8">
          <ArrowLeft className="w-4 h-4" /> Retounen
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-600/20">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Modifye PIN</h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2">Antre yon nouvo kòd sekirite (4 chif)</p>
        </div>

        <form onSubmit={handleUpdatePin} className="space-y-6">
          <div className="space-y-2 text-center">
            <label className="text-[8px] text-zinc-600 font-black uppercase tracking-widest block mb-2">Nouvo PIN</label>
            <input
              type="password"
              placeholder="••••"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-black border border-white/5 p-4 rounded-2xl focus:border-red-600 outline-none transition-all font-black text-center text-2xl tracking-[1em]"
              required
            />
          </div>

          <div className="space-y-2 text-center">
            <label className="text-[8px] text-zinc-600 font-black uppercase tracking-widest block mb-2">Konfime Nouvo PIN</label>
            <input
              type="password"
              placeholder="••••"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-black border border-white/5 p-4 rounded-2xl focus:border-red-600 outline-none transition-all font-black text-center text-2xl tracking-[1em]"
              required
            />
          </div>

          {error && <p className="text-red-500 text-[10px] font-black uppercase text-center">{error}</p>}
          {message && <p className="text-green-500 text-[10px] font-black uppercase text-center">{message}</p>}

          <button
            type="submit"
            disabled={isSaving || newPin.length !== 4 || confirmPin.length !== 4}
            className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-600/20 active:scale-95 transition-all text-[11px] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sove Nouvo PIN nan"}
          </button>
        </form>
      </div>
    </div>
  );
}