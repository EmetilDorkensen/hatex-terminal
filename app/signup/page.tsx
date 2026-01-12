"use client";
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      alert("Erè: " + error.message);
    } else {
      alert("Kont lan kreye! Tcheke imèl ou pou konfime l.");
      router.push('/login');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center p-6 italic">
      <form onSubmit={handleSignup} className="w-full max-w-md bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5">
        <h1 className="text-2xl font-black text-red-600 uppercase mb-6 text-center italic">Kreye Kont Hatex</h1>
        <div className="space-y-4">
          <input 
            type="email" placeholder="EMAIL" required 
            className="w-full bg-black/40 p-5 rounded-2xl border border-white/5 outline-none font-bold text-white focus:border-red-600"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            type="password" placeholder="MODPAS" required 
            className="w-full bg-black/40 p-5 rounded-2xl border border-white/5 outline-none font-bold text-white focus:border-red-600"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="w-full bg-red-600 py-6 rounded-2xl font-black uppercase text-xs italic active:scale-95 transition-all shadow-lg shadow-red-600/20">
            {loading ? "AP KREYE..." : "ANREJISTRE"}
          </button>
        </div>
      </form>
    </div>
  );
}