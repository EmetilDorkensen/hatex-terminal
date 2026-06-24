"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Mail, Lock, KeyRound, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

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

  // ==========================================
  // TRACKING IP AK APARÈY
  // ==========================================
  const trackDeviceAndIP = async (userEmail: string) => {
    try {
      // 1. Rale adrès IP entènèt kliyan an
      const res = await fetch('https://api.ipify.org?format=json');
      const { ip } = await res.json();
      
      // 2. Rale non aparèy la (ex: iPhone, Android, Windows)
      const device = navigator.userAgent;

      // 3. Mete yo ajou nan pwofil li an kachèt
      await supabase
        .from('profiles')
        .update({ last_ip: ip, last_device: device })
        .eq('email', userEmail.trim().toLowerCase());
        
    } catch (e) {
      console.error("Tracking error (ignored):", e);
      // Nou inyore erè a pou l pa anpeche kliyan an konekte si entènèt li twò dousman
    }
  };

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
          email: email.trim(),
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

          // 🚨 PRAN IP AK APARÈY LA ANVAN L ALE 🚨
          await trackDeviceAndIP(email);

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
          p_email: email.trim().toLowerCase(),
          p_pin: pin
        });

        if (rpcErr) {
          setErrorMsg("Gen yon pwoblèm nan verifye PIN ou an. Eseye ankò.");
          setLoading(false);
          return;
        }

        if (rpcData.success) {
          // PIN lan bon e kont lan pa sispandi. 
          
          // 🚨 PRAN IP AK APARÈY LA ANVAN L ALE 🚨
          await trackDeviceAndIP(email);
          
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl border border-gray-200 shadow-xl shadow-slate-200/50">
        
        {/* LOGO AK TIT */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
              <img src="https://i.imgur.com/xDk58Xk.png" alt="HatexCard Logo" className="w-14 h-14 object-contain" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-1">HatexCard</h1>
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500" /> Koneksyon Sekirize
          </p>
        </div>

        {/* BOUTON POU CHWAZI KIJAN W AP KONEKTE A */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl mb-8">
          <button 
            type="button"
            onClick={() => { setLoginMethod('password'); setErrorMsg(''); }}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${loginMethod === 'password' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Modpas
          </button>
          <button 
            type="button"
            onClick={() => { setLoginMethod('pin'); setErrorMsg(''); }}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${loginMethod === 'pin' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            PIN 4 Chif
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">Adrès Imèl</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                placeholder="moun@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
                required
              />
            </div>
          </div>

          {loginMethod === 'password' ? (
            <div className="space-y-1.5 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">Modpas</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium tracking-widest text-slate-900 placeholder:text-slate-400"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1 text-center block">Kòd PIN (4 Chif)</label>
              <div className="relative max-w-[200px] mx-auto">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  placeholder="••••"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-center text-xl tracking-[0.5em] text-slate-900 placeholder:text-slate-300"
                  required
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl mt-4 flex items-start gap-3">
               <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
               <p className="text-rose-700 text-[11px] font-bold uppercase tracking-wider leading-relaxed">{errorMsg}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 py-4 rounded-xl font-bold uppercase tracking-wider shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all text-xs mt-6 text-white disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Ap Verifye...</> : "Antre Nan Kont Mwen"}
          </button>
        </form>

        <div className="mt-8 text-center space-y-4 pt-6 border-t border-gray-100">
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
            Ou pa gen kont? <Link href="/signup" className="text-indigo-600 hover:text-indigo-800 transition-colors ml-1">Kreye yon kont</Link>
          </p>
          <Link href="/forgot-password" className="inline-block">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hover:text-indigo-500 transition-colors">
               Mwen bliye modpas mwen
            </p>
          </Link>
        </div>
      </div>
      
      <div className="mt-10 flex items-center gap-3 opacity-40">
         <div className="h-px w-8 bg-slate-400"></div>
         <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Secured by Hatex Group</span>
         <div className="h-px w-8 bg-slate-400"></div>
      </div>
    </div>
  );
}