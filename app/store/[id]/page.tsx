"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ShoppingBag, Globe, MessageSquare, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function MerchantStore({ params }: { params: { id: string } }) {
  const [merchant, setMerchant] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        // 1. Rale enfòmasyon Machann nan
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', params.id)
          .single();

        // 2. Rale tout pwodwi li yo
        const { data: prods } = await supabase
          .from('products')
          .select('*')
          .eq('owner_id', params.id)
          .order('created_at', { ascending: false });

        setMerchant(profile);
        setProducts(prods || []);
      } catch (error) {
        console.error("Erè:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStoreData();
  }, [params.id, supabase]);

  if (loading) return <div className="min-h-screen bg-[#06070d] flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={40} /></div>;

  if (!merchant) return <div className="min-h-screen bg-[#06070d] text-white flex items-center justify-center">Boutik sa a pa egziste.</div>;

  return (
    <div className="min-h-screen bg-[#06070d] text-white">
      {/* HEADER BOUTIK LA */}
      <div className="bg-gradient-to-b from-zinc-900 to-[#06070d] border-b border-white/5 p-8 pt-16">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-zinc-800 rounded-[2rem] border border-white/10 mb-4 flex items-center justify-center shadow-2xl overflow-hidden">
             {merchant.avatar_url ? <img src={merchant.avatar_url} className="w-full h-full object-cover" /> : <ShoppingBag size={40} className="text-zinc-600" />}
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">{merchant.full_name || "Boutik Ofisyèl"}</h1>
          <div className="flex items-center gap-2 mt-2 bg-green-500/10 text-green-500 px-4 py-1 rounded-full text-[10px] font-black uppercase border border-green-500/20">
            <ShieldCheck size={12} /> Machann Verifye pa Hatex
          </div>
        </div>
      </div>

      {/* LIS PWODWI YO */}
      <div className="max-w-6xl mx-auto p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] p-6 hover:border-red-600/50 transition-all group shadow-xl">
             <div className="flex justify-between items-start mb-6">
                <span className="bg-white/5 text-zinc-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{product.category}</span>
                <div className="text-right">
                   <p className="text-2xl font-black">{product.price}</p>
                   <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">HTG</p>
                </div>
             </div>

             <h2 className="text-xl font-bold mb-4 line-clamp-1 group-hover:text-red-500 transition-colors uppercase">{product.title}</h2>
             
             <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-xs text-zinc-500 font-bold">
                   <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> Livrezon Instantane
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500 font-bold">
                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> Garanti Escrow 1h15
                </div>
             </div>

             <Link href={`/subscribe/${product.id}`} className="block w-full bg-white text-black py-4 rounded-2xl text-center font-black uppercase text-xs hover:bg-red-600 hover:text-white transition-all shadow-lg group-hover:scale-[1.02]">
                Achte Abònman an <ArrowRight className="inline-block ml-2" size={14} />
             </Link>
          </div>
        ))}

        {products.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-30 uppercase font-black tracking-[0.2em]">
            Machann sa a pa gen okenn pwodwi aktif pou kounye a.
          </div>
        )}
      </div>

      {/* FOOTER BOUTIK */}
      <div className="p-12 text-center text-zinc-600 text-[10px] font-black uppercase tracking-widest">
         Sekirize pa <span className="text-white">Hatex Global System</span>
      </div>
    </div>
  );
}