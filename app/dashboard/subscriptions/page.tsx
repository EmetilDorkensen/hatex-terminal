"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Users, CreditCard, LayoutGrid, Plus, 
  ExternalLink, Trash2, Loader2, MoreVertical,
  TrendingUp, Calendar, Search, ShieldCheck 
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SubscriptionsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState({ total_revenue: 0, active_subs: 0 });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchDashboardData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Rale tout pwodwi machann nan
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      // 2. Rale Estatistik reyèl pou ranplase "0" yo
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('amount, status')
        .eq('merchant_id', user.id);

      if (subsData) {
        const active = subsData.filter(s => s.status === 'completed' || s.status === 'pending_escrow').length;
        const revenue = subsData.reduce((acc, curr) => acc + curr.amount, 0);
        setStats({ total_revenue: revenue, active_subs: active });
      }

      setProducts(productsData || []);
      setLoading(false);
    }

    fetchDashboardData();
  }, [supabase]);

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
      <Loader2 className="animate-spin text-red-600" size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-6 md:p-10 italic font-medium">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* HEADER AK BOUTON YO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-10">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">
              Dashboard <span className="text-red-600">Abònman</span>
            </h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-2 font-black">
              Jere tout sèvis rekirant ou yo yon sèl kote
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* BOUTON ESCROW (H-PAY SHIELD) */}
            <button 
              onClick={() => router.push('/dashboard/escrow')}
              className="bg-orange-500/10 border border-orange-500/20 text-orange-500 px-6 py-4 rounded-[1.8rem] font-black uppercase text-[10px] flex items-center gap-3 hover:bg-orange-500 hover:text-white transition-all shadow-xl"
            >
              <ShieldCheck size={18} /> Kòb Bloke (Escrow)
            </button>

            <button 
              onClick={() => router.push('/dashboard/subscriptions/new')}
              className="bg-white text-black px-8 py-4 rounded-[1.8rem] font-black uppercase text-[10px] flex items-center gap-3 hover:bg-zinc-200 transition-all shadow-xl"
            >
              <Plus size={18} /> Kreye Nivo
            </button>
          </div>
        </div>

        {/* KAT STATISTIK YO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0d0e1a] border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group">
            <TrendingUp className="absolute -right-4 -bottom-4 text-red-600/10 w-32 h-32 group-hover:scale-110 transition-transform" />
            <p className="text-[10px] text-zinc-500 font-black uppercase mb-2">Total Revenu</p>
            <h3 className="text-3xl font-black italic">{stats.total_revenue.toLocaleString()} <span className="text-sm text-red-600">HTG</span></h3>
          </div>
          <div className="bg-[#0d0e1a] border border-white/5 p-8 rounded-[2.5rem]">
            <p className="text-[10px] text-zinc-500 font-black uppercase mb-2">Kliyan Aktif</p>
            <h3 className="text-3xl font-black italic">{stats.active_subs} <span className="text-sm text-red-600">Moun</span></h3>
          </div>
          <div className="bg-[#0d0e1a] border border-white/5 p-8 rounded-[2.5rem]">
            <p className="text-[10px] text-zinc-500 font-black uppercase mb-2">Pwodwi sou Mache a</p>
            <h3 className="text-3xl font-black italic">{products.length} <span className="text-sm text-red-600">Atik</span></h3>
          </div>
        </div>

        {/* LIS PWODWI YO */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">Lis Pwodwi ou yo</h2>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
              <input 
                type="text" 
                placeholder="Chèche yon abònman..." 
                className="bg-black/40 border border-white/5 rounded-full pl-10 pr-6 py-2 text-[10px] font-bold outline-none focus:border-red-600 w-64"
              />
            </div>
          </div>

          {products.length === 0 ? (
            <div className="bg-[#0d0e1a] border border-white/5 rounded-[3rem] p-20 text-center">
              <LayoutGrid className="mx-auto text-zinc-800 mb-4" size={60} />
              <p className="text-zinc-600 font-black uppercase text-[10px]">Ou poko kreye okenn abònman</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] overflow-hidden group hover:border-red-600/30 transition-all shadow-2xl">
                  {/* Foto a */}
                  <div className="h-40 bg-zinc-900 relative overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-800"><LayoutGrid size={40}/></div>
                    )}
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase text-red-500 border border-white/10">
                      Chak {product.billing_cycle === 'month' ? 'Mwa' : product.billing_cycle === 'day' ? 'Jou' : product.billing_cycle === 'week' ? 'Semèn' : 'Lè'}
                    </div>
                  </div>

                  {/* Detay */}
                  <div className="p-6 space-y-4">
                    <div>
                      <span className="text-[9px] text-red-600 font-black uppercase tracking-widest">{product.category}</span>
                      <h4 className="text-lg font-black uppercase truncate">{product.title}</h4>
                    </div>

                    <div className="flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Users size={14} />
                        <span className="text-[10px] font-bold">0 Kliyan</span>
                      </div>
                      <div className="text-white font-black text-sm">
                        {product.price.toLocaleString()} <span className="text-[10px] text-red-600">HTG</span>
                      </div>
                    </div>

                    {/* Aksyon yo */}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const url = `${window.location.origin}/subscribe/${product.id}`;
                          navigator.clipboard.writeText(url);
                          alert("Lyen kopye nan clipboard!");
                        }}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-colors border border-white/5"
                      >
                        <ExternalLink size={14} /> Lyen
                      </button>
                      <button className="p-3 bg-red-600/10 hover:bg-red-600/20 text-red-600 rounded-xl transition-colors border border-red-600/10">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}