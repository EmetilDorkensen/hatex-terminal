"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { useSearchParams } from 'next/navigation';
import { User, Mail, Lock, Gift, AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function SignupForm() {
  const searchParams = useSearchParams();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    const promoFromUrl = searchParams.get("promo");
    if (promoFromUrl) {
      localStorage.setItem('hatex_promo', promoFromUrl);
      setPromoCode(promoFromUrl.toUpperCase());
    } else {
      const savedPromo = localStorage.getItem('hatex_promo');
      if (savedPromo) setPromoCode(savedPromo.toUpperCase());
    }
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    const cleanPromo = promoCode.trim().toUpperCase();
    let finalDiscountAmount = 0; 

    try {
      // 1. VERIFYE KÒD LA EPI PRAN KANTITE REDIKSYON AN
      if (cleanPromo !== '') {
        const { data: promoData, error: promoError } = await supabase
          .from('promo_codes')
          .select('code, usage_count, max_uses, reward_amount')
          .eq('code', cleanPromo)
          .maybeSingle();

        if (promoError || !promoData) {
          setMsg({ type: 'error', text: 'Kòd Pwomo sa a pa valab oswa li pa egziste nan sistèm nan!' });
          setLoading(false);
          return; 
        }

        if (promoData.max_uses !== null && promoData.usage_count >= promoData.max_uses) {
          setMsg({ type: 'error', text: `Kòd Pwomo ${cleanPromo} an atenn limit li. Li pa valab ankò!` });
          setLoading(false);
          return;
        }
        finalDiscountAmount = promoData.reward_amount || 0;
      }

      // 2. KREYE KONT KLIYAN AN
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
      });

      if (authError) {
        if (authError.message.includes("User already registered") || authError.status === 400) {
          throw new Error("Imèl sa a gen yon kont sou li deja! Tanpri fè Konekte (Login).");
        }
        throw authError;
      }

      if (authData.user) {
        // A) Sove Pwofil la
        await supabase.from('profiles').insert([{
          id: authData.user.id,
          full_name: fullName,
          kyc_status: 'pending',
          used_promo: cleanPromo !== '' ? cleanPromo : null
        }]);

        // B) NOUVO: Sove ID kliyan an ak rediksyon an nan espas apa a (Tiroir a)
        if (finalDiscountAmount > 0) {
          await supabase.from('user_discounts').insert([{
            user_id: authData.user.id,
            promo_code: cleanPromo,
            discount_amount: finalDiscountAmount
          }]);
        }

        localStorage.removeItem('hatex_promo');
        setMsg({ type: 'success', text: 'Kont la kreye! Tanpri tcheke imèl ou pou konfime enskripsyon an.' });
      }

    } catch (error: any) {
      setMsg({ type: 'error', text: error.message || 'Gen yon erè ki rive pandan kreyasyon an.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl border border-gray-200 shadow-xl shadow-slate-200/50">
      
      {/* LOGO AK TIT */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
            <img src="https://i.imgur.com/xDk58Xk.png" alt="HatexCard Logo" className="w-14 h-14 object-contain" />
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-1">Hatexcard</h1>
        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-indigo-500" /> Kreye Yon Kont Nouvo
        </p>
      </div>

      <form onSubmit={handleSignup} className="space-y-5">
        
        {/* NON KONPLÈ */}
        <div className="space-y-1.5 text-left">
          <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">Non Konplè Ou</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-slate-400" />
            </div>
            <input 
              type="text" 
              placeholder="Ex: Jean Jacques" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400" 
              required 
            />
          </div>
        </div>

        {/* IMÈL */}
        <div className="space-y-1.5 text-left">
          <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">Adrès Imèl</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-400" />
            </div>
            <input 
              type="email" 
              placeholder="kliyan@email.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400" 
              required 
            />
          </div>
        </div>

        {/* MODPAS */}
        <div className="space-y-1.5 text-left">
          <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">Modpas Sekirize</label>
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

        {/* PWOMO */}
        <div className="space-y-1.5 text-left">
          <label className="text-[10px] font-bold uppercase text-indigo-500 tracking-wider ml-1">Kòd Pwomo (Opsyonèl)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Gift className="h-5 w-5 text-indigo-400" />
            </div>
            <input 
              type="text" 
              placeholder="EX: IZO2026" 
              value={promoCode} 
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())} 
              className="w-full pl-11 pr-4 py-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm font-bold text-indigo-700 placeholder:text-indigo-300 uppercase tracking-widest" 
            />
          </div>
        </div>

        {/* MESSAGES */}
        {msg.text && (
          <div className={`p-4 rounded-xl mt-4 flex items-start gap-3 border ${msg.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
             {msg.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
             <p className="text-[11px] font-bold uppercase tracking-wider leading-relaxed">{msg.text}</p>
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading} 
          className="w-full bg-indigo-600 hover:bg-indigo-700 py-4 rounded-xl font-bold uppercase tracking-wider shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all text-xs mt-6 text-white disabled:opacity-70 flex justify-center items-center gap-2"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Ap Kreye Kont Lan...</> : "Kreye Kont Mwen"}
        </button>
      </form>

      <div className="mt-8 text-center space-y-4 pt-6 border-t border-gray-100">
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
          Ou gen kont deja? <Link href="/login" className="text-indigo-600 hover:text-indigo-800 transition-colors ml-1">Konekte La</Link>
        </p>
      </div>
    </div>
  );
}

export default function Signup() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <Suspense fallback={
        <div className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
          <p className="text-sm font-semibold text-slate-600 tracking-wide uppercase">Chajman...</p>
        </div>
      }>
        <SignupForm />
      </Suspense>
      
      <div className="mt-10 flex items-center gap-3 opacity-40">
         <div className="h-px w-8 bg-slate-400"></div>
         <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Secured by Hatex Group</span>
         <div className="h-px w-8 bg-slate-400"></div>
      </div>
    </div>
  );
}