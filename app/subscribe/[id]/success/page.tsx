"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { CheckCircle2, AlertTriangle, Copy, Key, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function SuccessPage({ params }: { params: { id: string } }) {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchSubscriptionDetails = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Ou pa konekte.");

        // Rale dènye abònman kliyan sa a fè pou pwodwi sa a
        const { data, error: subError } = await supabase
          .from('subscriptions')
          .select('*, products(title, category)')
          .eq('product_id', params.id)
          .eq('client_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (subError || !data) throw new Error("Nou pa jwenn tranzaksyon sa a.");

        setSubscription(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionDetails();
  }, [params.id, supabase]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Kopye ak siksè!");
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
      <Loader2 className="animate-spin text-green-500" size={48} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center text-white p-6">
      <div className="bg-red-600/10 p-8 rounded-[2rem] border border-red-500/20 text-center max-w-md">
        <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
        <p className="font-bold">{error}</p>
      </div>
    </div>
  );

  const creds = subscription.provided_credentials;

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 md:p-8 flex items-center justify-center font-medium">
      <div className="w-full max-w-[700px] bg-[#0d0e1a] border border-white/5 rounded-[3rem] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
        
        {/* HEADER SIKSÈ */}
        <div className="bg-gradient-to-b from-green-500/10 to-transparent p-10 text-center border-b border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-green-500/20 blur-[50px] rounded-full"></div>
          <CheckCircle2 className="text-green-500 mx-auto mb-4 relative z-10" size={64} />
          <h1 className="text-3xl font-black uppercase tracking-tighter relative z-10">Peman Reyisi</h1>
          <p className="text-zinc-400 mt-2 text-sm relative z-10">Abònman <span className="text-white font-bold">{subscription.products?.title}</span> ou a aktive.</p>
        </div>

        <div className="p-8 space-y-8">
          
          {/* SÈKSYON ENFÒMASYON KONT STREAMING NAN */}
          {creds ? (
            <div className="bg-black border border-white/10 rounded-3xl p-6 relative">
              <div className="absolute -top-4 left-6 bg-red-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg">
                <Key size={12} /> Enfòmasyon Kont ou an
              </div>
              
              <div className="mt-4 space-y-4">
                {creds.email && (
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Imèl / Itilizatè</p>
                      <p className="font-mono text-sm">{creds.email}</p>
                    </div>
                    <button onClick={() => copyToClipboard(creds.email)} className="text-zinc-400 hover:text-white bg-white/10 p-2 rounded-xl transition-all"><Copy size={16} /></button>
                  </div>
                )}
                
                {creds.password && (
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Modpas</p>
                      <p className="font-mono text-sm">{creds.password}</p>
                    </div>
                    <button onClick={() => copyToClipboard(creds.password)} className="text-zinc-400 hover:text-white bg-white/10 p-2 rounded-xl transition-all"><Copy size={16} /></button>
                  </div>
                )}

                {creds.pin && (
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-red-500/20">
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Kòd PIN Pwofil</p>
                      <p className="font-mono text-lg font-black text-red-500 tracking-widest">{creds.pin}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl text-center text-zinc-400 text-sm">
              <p>Machann nan ap kontakte w talè konsa ak detay abònman ou an, oubyen ou ka sèvi ak lyen pwodwi a dirèk.</p>
            </div>
          )}

          {/* BOUTON RETOUNEN */}
          <Link href="/dashboard" className="block text-center text-[10px] text-zinc-500 font-black uppercase tracking-widest hover:text-white transition-colors">
            Retounen nan Dashboard la
          </Link>
          
        </div>
      </div>
    </div>
  );
}