"use client";
import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { useSearchParams } from 'next/navigation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function SignupForm() {
  const searchParams = useSearchParams();
  const referredByCode = searchParams.get("ref");
  const urlPromoCode = searchParams.get("promo"); // Si l nan lyen an tou

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [promoCode, setPromoCode] = useState(urlPromoCode || ''); // NOUVO: Eta pou kòd pwomo a
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      if (authError) {
        if (authError.message.includes("User already registered") || authError.status === 400) {
          throw new Error("Imèl sa a gen yon kont sou li deja! Tanpri fè Konekte (Login).");
        }
        throw authError;
      }

      if (authData.user) {
        // Sove tout bagay, enkli Kòd Pwomo a
        const cleanPromo = promoCode.trim().toUpperCase(); // Mete l an majiskil pikan
        
        const { error: profileError } = await supabase.from('profiles').insert([
          {
            id: authData.user.id,
            full_name: fullName,
            kyc_status: 'pending',
            referred_by: referredByCode || null,
            used_promo: cleanPromo !== '' ? cleanPromo : null, // Sove pwomo a la a
            referral_code: `htx_${Math.random().toString(36).substring(2, 8)}`
          }
        ]);

        if (profileError) {
           console.error("Erè lè ap kreye pwofil:", profileError);
        }

        setMsg({ 
          type: 'success', 
          text: 'Kont la kreye! Tanpri tcheke imèl ou pou konfime enskripsyon an.' 
        });
      }

    } catch (error: any) {
      setMsg({ type: 'error', text: error.message || 'Gen yon erè ki rive.' });
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
          <label className="text-[8px] text-zinc-600 ml-2">NON KONPLÈ OU</label>
          <input
            type="text"
            placeholder="EX: DORKENSEN EXEMPLE"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-black border border-white/5 p-5 rounded-2xl focus:border-red-600 outline-none transition-all font-bold text-xs"
            required
          />
        </div>

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

        {/* Bwat Kòd Pwomo a */}
        <div className="space-y-2 text-left">
          <label className="text-[8px] text-purple-500 ml-2">KÒD PWOMO (OPSYONÈL)</label>
          <input
            type="text"
            placeholder="EX: VIP500"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            className="w-full bg-black border border-purple-500/30 p-5 rounded-2xl focus:border-purple-600 outline-none transition-all font-bold text-xs text-purple-400 placeholder:text-zinc-700"
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
  );
}

export default function Signup() {
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex flex-col items-center justify-center p-6 italic uppercase font-black">
      <Suspense fallback={<div className="text-red-600 text-sm">Ap chaje...</div>}>
        <SignupForm />
      </Suspense>
      <div className="mt-8 flex items-center gap-3 opacity-20">
         <div className="h-[1px] w-12 bg-white"></div>
         <span className="text-[8px] tracking-[0.4em]">SECURED ENCRYPTION</span>
         <div className="h-[1px] w-12 bg-white"></div>
      </div>
    </div>
  );
}