"use client";

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { ArrowLeft, Mail, Lock, AlertCircle } from 'lucide-react';

export default function WooCommerceOAuthContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('return_url');
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Verifye machann nan nan baz done HATEX
      const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !user) {
        setError('Imèl oswa modpas pa bon.');
        setLoading(false);
        return;
      }

      // 2. Chèche pwofil la
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        setError('Pa ka jwenn pwofil ou.');
        setLoading(false);
        return;
      }

      // 3. Verifye KYC
      if (profile.kyc_status !== 'approved') {
        setError('KYC ou poko apwouve. Tanpri tann apwobasyon an.');
        setLoading(false);
        return;
      }

      // 4. Jenere yon token (ka itilize yon ID inik)
      const token = crypto.randomUUID();

      // 5. Anrejistre token an nan baz done
      const { error: tokenError } = await supabase
        .from('oauth_tokens')
        .insert({
          user_id: user.id,
          token: token,
          platform: 'woocommerce',
          expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 èdtan
        });

      if (tokenError) {
        setError('Pa ka jenere token an.');
        setLoading(false);
        return;
      }

      // 6. Redireksyon tounen nan WooCommerce la ak token an
      if (returnUrl) {
        const redirectUrl = new URL(returnUrl);
        redirectUrl.searchParams.set('hatex_token', token);
        window.location.href = redirectUrl.toString();
      } else {
        // Si pa gen returnUrl, voye yo nan dashboard la
        router.push('/dashboard');
      }

    } catch (err) {
      setError('Yon erè inatandi te rive.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b14] to-black text-white flex items-center justify-center p-4">
      <div className="bg-[#0d0e1a] border border-white/5 rounded-[2rem] p-12 max-w-md w-full">
        <div className="flex items-center gap-2 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/10 rounded-xl transition-all"
          >
            <ArrowLeft size={20} className="text-zinc-400" />
          </button>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">
            HATEX<span className="text-red-600">.</span>
          </h1>
        </div>
        
        <p className="text-zinc-400 mb-8">Konekte ak kont ou pou otorize WooCommerce</p>

        {error && (
          <div className="bg-red-600/20 border border-red-600/30 p-4 rounded-xl mb-6 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleConnect} className="space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">
              Imèl
            </label>
            <div className="relative mt-2">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-black/40 border border-white/10 py-4 pl-12 pr-6 rounded-2xl text-sm outline-none focus:border-red-600/50 transition-all"
                placeholder="machann@gmail.com"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">
              Modpas
            </label>
            <div className="relative mt-2">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-black/40 border border-white/10 py-4 pl-12 pr-6 rounded-2xl text-sm outline-none focus:border-red-600/50 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Ap konekte...
              </span>
            ) : (
              'Konekte ak HATEX'
            )}
          </button>
        </form>

        <p className="text-[10px] text-zinc-600 text-center mt-6">
          Lè w klike "Konekte", ou otorize HATEX pou konekte ak boutik WooCommerce ou a.
        </p>
      </div>
    </div>
  );
}