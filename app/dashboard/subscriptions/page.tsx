"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Users, LayoutGrid, Plus, 
  ExternalLink, Trash2, Loader2, 
  TrendingUp, Search, ShieldCheck,
  ShieldAlert, Lock
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SubscriptionsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [kycApproved, setKycApproved] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState({ total_revenue: 0, active_subs: 0 });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchDashboardData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // 1. VERIFIKASYON KYC AVAN TOUT BAGAY
      const { data: profile } = await supabase
        .from('profiles')
        .select('kyc_status')
        .eq('id', user.id)
        .single();

      if (profile?.kyc_status !== 'verified') {
        setKycApproved(false);
        setLoading(false);
        return; 
      }

      setKycApproved(true);

      // 2. Rale pwodwi yo (Sèlman si KYC a verifye)
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      // 3. Rale Estatistik reyèl yo
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
  }, [supabase, router]);

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-red-600 mb-4 w-12 h-12" />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 animate-pulse">H-Pay Loading...</p>
    </div>
  );

  if (!kycApproved) return (
    <div className="min-h-screen bg-[#06070d] text-white flex flex-col items-center justify-center p-6 md:p-10 text-center selection:bg-red-600">
      <div className="relative mb-8 md:mb-12">
        <div className="absolute inset-0 bg-red-600 blur-[80px] opacity-20 rounded-full" />
        <div className="relative w-32 h-32 bg-red-600/10 rounded-full flex items-center justify-center border-2 border-red-600/30">
          <Lock className="text-red-600 w-12 h-12" />
        </div>
      </div>
      
      <h1 className="text-4xl md:text-6xl lg:text-8xl font-black uppercase tracking-tighter italic leading-none mb-6">Aksè <span className="text-red-600">Refize</span></h1>
      <p className="text-zinc-500 text-sm md:text-base font-bold max-w-lg mx-auto mb-10 leading-relaxed italic border-l-4 border-red-600/20 pl-4">
        Ou pa ka jere oswa kreye abònman paske kont ou poko verifye. Konfòme ak règleman H-Pay yo (KYC) pou w ka vann sèvis ou yo.
      </p>

      <button 
        onClick={() => router.push('/dashboard/kyc')} 
        className="bg-white text-black px-10 py-5 md:px-14 md:py-6 rounded-full font-black uppercase text-[10px] md:text-[12px] tracking-[0.4em] hover:scale-105 transition-all shadow-[0_20px_50px_-15px_rgba(255,255,255,0.3)] flex items-center gap-3"
      >
        <ShieldCheck className="w-5 h-5" /> Verifye Idantite w
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 sm:p-6 md:p-10 italic font-medium selection:bg-red-600">
      <div className="max-w-7xl mx-auto space-y-8 md:space-y-12">
        
        {/* HEADER AK BOUTON YO */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 md:gap-8 border-b border-white/5 pb-8 md:pb-10">
          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black uppercase tracking-tighter italic leading-none">
              Dashboard <span className="text-red-600">Abònman</span>
            </h1>
            <p className="text-zinc-500 text-[9px] md:text-[11px] font-black uppercase tracking-[0.4em] mt-2">
              Jere tout sèvis rekirant ou yo yon sèl kote
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full lg:w-auto">
            <button 
              onClick={() => router.push('/dashboard/escrow')}
              className="w-full sm:w-auto bg-orange-500/10 border border-orange-500/20 text-orange-500 px-6 md:px-8 py-4 md:py-5 rounded-full md:rounded-[2rem] font-black uppercase text-[10px] flex items-center justify-center gap-3 hover:bg-orange-500 hover:text-white transition-all shadow-xl"
            >
              <ShieldAlert className="w-4 h-4 md:w-5 md:h-5" /> Kòb nan Escrow
            </button>

            <button 
              onClick={() => router.push('/dashboard/subscriptions/new')}
              className="w-full sm:w-auto bg-white text-black px-8 py-4 md:py-5 rounded-full md:rounded-[2rem] font-black uppercase text-[10px] flex items-center justify-center gap-3 hover:bg-red-600 hover:text-white transition-all shadow-xl"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" /> Kreye Nouvo
            </button>
          </div>
        </div>

        {/* KAT STATISTIK YO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-[#0d0e1a] border border-white/5 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] relative overflow-hidden group shadow-2xl border-b-4 border-b-red-600">
            <TrendingUp className="absolute -right-4 -bottom-4 text-red-600/10 w-32 h-32 group-hover:scale-110 transition-transform duration-700" />
            <p className="text-[9px] md:text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-2 md:mb-4">Total Revenu</p>
            <div className="flex items-end gap-2">
              <h3 className="text-3xl md:text-5xl font-black italic tracking-tighter">{stats.total_revenue.toLocaleString()}</h3>
              <span className="text-xs md:text-sm text-red-600 font-black mb-1 md:mb-2">HTG</span>
            </div>
          </div>
          
          <div className="bg-[#0d0e1a] border border-white/5 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl relative overflow-hidden group">
            <Users className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32 group-hover:scale-110 transition-transform duration-700" />
            <p className="text-[9px] md:text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-2 md:mb-4">Kliyan Aktif</p>
            <div className="flex items-end gap-2">
              <h3 className="text-3xl md:text-5xl font-black italic tracking-tighter">{stats.active_subs}</h3>
              <span className="text-xs md:text-sm text-red-600 font-black mb-1 md:mb-2">MOUN</span>
            </div>
          </div>
          
          <div className="bg-[#0d0e1a] border border-white/5 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl sm:col-span-2 lg:col-span-1 relative overflow-hidden group">
            <LayoutGrid className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32 group-hover:scale-110 transition-transform duration-700" />
            <p className="text-[9px] md:text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-2 md:mb-4">Pwodwi Kreye</p>
            <div className="flex items-end gap-2">
              <h3 className="text-3xl md:text-5xl font-black italic tracking-tighter">{products.length}</h3>
              <span className="text-xs md:text-sm text-red-600 font-black mb-1 md:mb-2">ATIK</span>
            </div>
          </div>
        </div>

        {/* LIS PWODWI YO */}
        <div className="space-y-6 md:space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/5 pb-4 md:pb-6 gap-4">
            <h2 className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] text-zinc-400">Lis Pwodwi w yo</h2>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4 md:w-5 md:h-5" />
              <input 
                type="text" 
                placeholder="Chèche yon abònman..." 
                className="w-full sm:w-72 bg-black/40 border border-white/5 rounded-full pl-12 pr-6 py-4 md:py-4 text-[10px] md:text-[11px] font-bold outline-none focus:border-red-600 transition-colors"
              />
            </div>
          </div>

          {products.length === 0 ? (
            <div className="bg-[#0d0e1a] border border-white/5 rounded-[3rem] md:rounded-[4rem] p-12 md:p-24 text-center">
              {/* KORIJE IKÒN NAN ISIT LA */}
              <LayoutGrid className="mx-auto text-zinc-800 mb-6 w-16 h-16 md:w-20 md:h-20" />
              <p className="text-zinc-500 font-black uppercase text-[10px] md:text-[12px] tracking-[0.4em]">Ou poko kreye okenn abònman</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {products.map((product) => (
                <div key={product.id} className="bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] md:rounded-[3rem] overflow-hidden group hover:border-red-600/40 transition-all duration-500 shadow-2xl flex flex-col h-full">
                  
                  {/* Foto a */}
                  <div className="h-40 md:h-48 bg-zinc-900 relative overflow-hidden shrink-0">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.title} className="w-full h-full object-cover opacity-70 group-hover:scale-110 group-hover:opacity-100 transition-all duration-700" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-800">
                         {/* KORIJE LÒT IKÒN NAN ISIT LA TOU */}
                         <LayoutGrid className="w-10 h-10 md:w-12 md:h-12" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e1a] to-transparent opacity-90" />
                    
                    <div className="absolute top-4 right-4 md:top-5 md:right-5 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-[8px] md:text-[9px] font-black uppercase text-white border border-white/10 shadow-lg">
                      Chak {product.billing_cycle === 'month' ? 'Mwa' : product.billing_cycle === 'day' ? 'Jou' : product.billing_cycle === 'week' ? 'Semèn' : 'Ane'}
                    </div>
                  </div>

                  {/* Detay Pwodwi a */}
                  <div className="p-6 md:p-8 flex flex-col flex-1 gap-5 -mt-10 relative z-10">
                    <div className="flex-1">
                      <span className="text-[8px] md:text-[9px] text-red-500 font-black uppercase tracking-[0.3em]">{product.category}</span>
                      <h4 className="text-xl md:text-2xl font-black uppercase truncate mt-1 leading-tight">{product.title}</h4>
                    </div>

                    <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl md:rounded-[1.5rem] border border-white/5 mt-auto">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="text-[9px] md:text-[10px] font-bold">0 Abone</span>
                      </div>
                      <div className="text-white font-black text-sm md:text-base tracking-tighter">
                        {product.price.toLocaleString()} <span className="text-[9px] md:text-[10px] text-red-600">HTG</span>
                      </div>
                    </div>

                    {/* Aksyon yo */}
                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => {
                          const encryptedId = btoa(product.id);
                          const url = `${window.location.origin}/subscribe/${encryptedId}`;
                          navigator.clipboard.writeText(url);
                          alert("Lyen kripte a kopye avèk siksè!");
                        }}
                        className="flex-1 bg-white/5 hover:bg-red-600 text-white py-4 md:py-5 rounded-2xl md:rounded-[1.5rem] text-[9px] md:text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all duration-300 border border-white/5 hover:border-red-600 shadow-lg"
                      >
                        <ExternalLink className="w-4 h-4" /> Kopye Lyen
                      </button>
                      
                      <button className="p-4 md:p-5 bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white rounded-2xl md:rounded-[1.5rem] transition-all duration-300 border border-red-600/10 shrink-0 shadow-lg">
                        <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
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