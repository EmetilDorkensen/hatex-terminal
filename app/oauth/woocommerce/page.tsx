"use client";

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr'; // Chanje sa a

export default function WooCommerceOAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('return_url');
  const router = useRouter();

  // Kreye supabase client la
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !user) {
        alert('Imèl oswa modpas pa bon.');
        setLoading(false);
        return;
      }

      // Jenere yon token inik
      const token = crypto.randomUUID();

      // Anrejistre token an nan tab oauth_tokens
      const { error: tokenError } = await supabase
        .from('oauth_tokens')
        .insert({
          user_id: user.id,
          token: token,
          platform: 'woocommerce',
          expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 èdtan
        });

      if (tokenError) {
        console.error('Token insert error:', tokenError);
        alert('Erè pandan jenere token an.');
        setLoading(false);
        return;
      }

      // Redireksyon tounen ak token an
      const redirectUrl = new URL(returnUrl || 'https://example.com');
      redirectUrl.searchParams.set('hatex_token', token);
      router.push(redirectUrl.toString());

    } catch (err) {
      console.error('OAuth error:', err);
      alert('Yon erè te rive. Tanpri rekòmanse.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b14] to-black text-white flex items-center justify-center p-4">
      <div className="bg-[#0d0e1a] border border-white/5 rounded-[2rem] p-12 max-w-md w-full">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter mb-2">
          HATEX<span className="text-red-600">.</span>
        </h1>
        <p className="text-zinc-400 mb-8">Konekte ak kont ou pou otorize WooCommerce</p>

        <form onSubmit={handleConnect} className="space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">
              Imèl
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-black/40 border border-white/10 py-4 px-6 rounded-2xl text-sm outline-none focus:border-red-600/50 transition-all mt-2"
              placeholder="machann@gmail.com"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">
              Modpas
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-black/40 border border-white/10 py-4 px-6 rounded-2xl text-sm outline-none focus:border-red-600/50 transition-all mt-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-40"
          >
            {loading ? 'Ap konekte...' : 'Konekte ak HATEX'}
          </button>
        </form>

        <p className="text-[10px] text-zinc-600 text-center mt-6">
          Lè w klike "Konekte", ou otorize HATEX pou konekte ak boutik WooCommerce ou a.
        </p>
      </div>
    </div>
  );
}