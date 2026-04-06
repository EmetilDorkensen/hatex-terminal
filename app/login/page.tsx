"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

export default function Login() {
  const [loginMethod, setLoginMethod] = useState<'password' | 'pin'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sèvi ak createBrowserClient pou li ka mache ak Middleware la
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (loginMethod === 'password') {
        // ==========================================
        // 1. KONEKSYON AK MODPAS
        // ==========================================
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
          // VERIFYE SI KONT LAN TE SISPANDI ANVAN L ANTRE SOU DASHBOARD LA
          const { data: profile } = await supabase
            .from('profiles')
            .select('account_status')
            .eq('id', data.user.id)
            .single();

          if (profile?.account_status === 'suspended') {
            await supabase.auth.signOut(); // Fout li deyò menm kote a!
            setErrorMsg("Aksè Refize! Kont ou sispandi. Tanpri kontakte sipò a.");
            setLoading(false);
            return;
          }

          // Sèvi ak replace epi fose yon refresh pou Middleware la wè nouvo Cookie a
          window.location.href = '/dashboard';
        }

      } else {
        // ==========================================
        // 2. KONEKSYON AK PIN (4 CHIF)
        // ==========================================
        if (pin.length !== 4) {
          setErrorMsg("PIN lan dwe gen egzakteman 4 chif.");
          setLoading(false);
          return;
        }

        // Rele fonksyon entelijan nou kreye nan baz done a
        const { data: rpcData, error: rpcErr } = await supabase.rpc('verify_wallet_pin', {
          p_email: email,
          p_pin: pin
        });

        if (rpcErr) {
          setErrorMsg("Gen yon pwoblèm nan verifye PIN ou an. Eseye ankò.");
          setLoading(false);
          return;
        }

        if (rpcData.success) {
          // PIN lan bon e kont lan pa sispandi. 
          window.location.href = '/dashboard';
        } else {
          // Afiche mesaj erè a ki soti dirèk nan baz done a (ex: "Ou rete 2 chans" oswa "Kont ou sispandi")
          setErrorMsg(rpcData.message); 
          setLoading(false);
        }
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

        {/* BOUTON POU CHWAZI KIJAN W AP KONEKTE A */}
        <div className="flex bg-black p-1 rounded-2xl mb-8 border border-white/5">
          <button 
            type="button"
            onClick={() => { setLoginMethod('password'); setErrorMsg(''); }}
            className={`flex-1 py-3 text-[9px] font-black tracking-widest rounded-xl transition-all ${loginMethod === 'password' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
          >
            Modpas
          </button>
          <button 
            type="button"
            onClick={() => { setLoginMethod('pin'); setErrorMsg(''); }}
            className={`flex-1 py-3 text-[9px] font-black tracking-widest rounded-xl transition-all ${loginMethod === 'pin' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
          >
            PIN 4 Chif
          </button>
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

          {loginMethod === 'password' ? (
            <div className="space-y-2 text-left animate-in fade-in zoom-in duration-300">
              <label className="text-[8px] text-zinc-600 ml-2">MODPAS</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-white/5 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-bold text-xs tracking-widest"
                required
              />
            </div>
          ) : (
            <div className="space-y-2 text-left animate-in fade-in zoom-in duration-300">
              <label className="text-[8px] text-zinc-600 ml-2">KÒD PIN (4 CHIF)</label>
              <input
                type="password"
                placeholder="••••"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} // Anpeche yo tape lèt
                className="w-full bg-black border border-white/5 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-black text-center text-2xl tracking-[1em]"
                required
              />
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-600/10 border border-red-600/20 p-4 rounded-xl mt-4">
               <p className="text-red-500 text-[10px] font-black uppercase text-center leading-relaxed">{errorMsg}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 py-5 rounded-2xl font-black uppercase italic shadow-lg shadow-red-600/20 active:scale-95 transition-all text-sm mt-6 disabled:opacity-50"
          >
            {loading ? "AP VERIFYE..." : "ANTRE NAN KONT MWEN"}
          </button>
        </form>

        <div className="mt-10 text-center space-y-4">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            Ou pa gen kont? <Link href="/signup" className="text-red-600 hover:text-white transition-colors">Kreye yon kont</Link>
          </p>
          <Link href="/forgot-password">
            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest cursor-pointer hover:text-red-500 mt-2">
                Mwen bliye modpas mwen
            </p>
          </Link>
        </div>
      </div>
      <div className="mt-8 flex items-center gap-3 opacity-20">
         <div className="h-[1px] w-12 bg-white"></div>
         <span className="text-[8px] tracking-[0.4em]">SECURED BY HATEX GROUP</span>
         <div className="h-[1px] w-12 bg-white"></div>
      </div>
    </div>
  );
}