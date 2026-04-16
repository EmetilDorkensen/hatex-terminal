"use client";
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { useSearchParams } from 'next/navigation';

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
    <div className="w-full max-w-md bg-zinc-900/30 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-md">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black tracking-tighter italic text-red-600 mb-2 underline decoration-white/10">HatexCard</h1>
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold tracking-widest">KREYE YON KONT NOUVO</p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-2 text-left">
          <label className="text-[8px] text-zinc-600 ml-2 font-black">NON KONPLÈ OU</label>
          <input type="text" placeholder="EX: DORKENSEN EXEMPLE" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-black border border-white/5 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-bold text-xs" required />
        </div>

        <div className="space-y-2 text-left">
          <label className="text-[8px] text-zinc-600 ml-2 font-black">ADRÈS IMÈL</label>
          <input type="email" placeholder="CLIENT@EMAIL.COM" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black border border-white/5 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-bold text-xs" required />
        </div>

        <div className="space-y-2 text-left">
          <label className="text-[8px] text-zinc-600 ml-2 font-black">MODPAS SEKIRIZE</label>
          <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black border border-white/5 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-bold text-xs" required />
        </div>

        <div className="space-y-2 text-left">
          <label className="text-[8px] text-purple-500 ml-2 font-black">KÒD PWOMO (OPSYONÈL)</label>
          <input type="text" placeholder="EX: IZO2026" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} className="w-full bg-black border border-purple-500/30 p-5 rounded-2xl focus:border-purple-600 outline-none transition-all font-bold text-xs text-purple-400 placeholder:text-zinc-700 uppercase" />
        </div>

        {msg.text && (
          <div className={`p-4 rounded-xl border ${msg.type === 'error' ? 'bg-red-600/10 border-red-600/20 text-red-500' : 'bg-green-600/10 border-green-600/20 text-green-500'}`}>
             <p className="text-[10px] font-black uppercase text-center">{msg.text}</p>
          </div>
        )}

        <button type="submit" disabled={loading} className="w-full bg-red-600 py-5 rounded-2xl font-black uppercase italic shadow-lg shadow-red-600/20 active:scale-95 transition-all text-sm mt-4 disabled:opacity-50">
          {loading ? "AP VERIFYE..." : "KREYE KONT MWEN"}
        </button>
      </form>

      <div className="mt-10 text-center">
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          Ou gen kont deja? <Link href="/login" className="text-red-600 hover:text-white transition-colors">Konekte la</Link>
        </p>
      </div>
    </div>
  );
}

export default function Signup() {
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex flex-col items-center justify-center p-6 italic uppercase font-black">
      <Suspense fallback={<div className="text-red-600 text-sm">Ap chaje...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}