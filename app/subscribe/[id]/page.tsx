"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

export default function SubscribePage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchData() {
      try {
        if (!id) return;

        // 1. Rale enfòmasyon pwodwi a
        const { data: productData, error: pError } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .single();

        if (pError) throw new Error("Pwodwi sa a pa egziste.");
        setProduct(productData);

        // 2. Rale enfòmasyon itilizatè a si l konekte
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          setProfile(profileData);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, supabase]);

  const handleSubscribe = async () => {
    // Sekirite KYC pou Build la ak pou itilizatè a
    if (!profile) {
      router.push('/login');
      return;
    }

    if (profile?.kyc_status !== 'verified' && profile?.kyc_status !== 'approved') {
      alert("Ou dwe verifye KYC ou anvan ou fè abònman.");
      return;
    }

    // Lojik peman an ale la...
    console.log("Abònman ap fèt...");
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
      <Loader2 className="animate-spin text-red-600" size={40} />
    </div>
  );

  if (error || !product) return (
    <div className="min-h-screen bg-[#06070d] text-white flex flex-col items-center justify-center p-6">
      <AlertCircle size={50} className="text-red-600 mb-4" />
      <p className="font-black uppercase tracking-widest text-xs">{error || "Pwodwi pa jwenn"}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white italic font-medium p-6">
      <div className="max-w-xl mx-auto space-y-8 mt-10">
        
        {/* HEADER PWODWI */}
        <div className="bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="h-64 bg-zinc-900">
            {product.image_url && (
              <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
            )}
          </div>
          
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-red-600 font-black uppercase tracking-[0.2em]">{product.category}</span>
                <h1 className="text-3xl font-black uppercase tracking-tighter mt-1">{product.title}</h1>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black italic">{product.price.toLocaleString()} HTG</p>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Chak {product.billing_cycle}</p>
              </div>
            </div>

            <p className="text-zinc-400 text-sm leading-relaxed">{product.description}</p>

            {/* SEKSYON PROFIL (Ranje erè avatar_url la) */}
            <div className="flex items-center gap-4 p-4 bg-black/40 rounded-2xl border border-white/5">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 border border-white/10">
                <img 
                  src={profile?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hatex'} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Kliyan</p>
                <p className="text-sm font-black uppercase tracking-tighter">
                  {profile?.full_name || "Vizitè"}
                </p>
              </div>
            </div>

            <button 
              onClick={handleSubscribe}
              className="w-full bg-red-600 py-5 rounded-2xl font-black uppercase text-[12px] tracking-[0.3em] hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 flex items-center justify-center gap-3 italic"
            >
              <CreditCard size={18} /> Konfime Abònman
            </button>
            
            <div className="flex items-center justify-center gap-2 text-[9px] text-zinc-600 font-black uppercase tracking-widest">
              <ShieldCheck size={14} /> Peman an sekirite pa H-Pay Shield
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}