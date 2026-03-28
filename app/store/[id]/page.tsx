"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Loader2, Search, ExternalLink, ShieldCheck, 
  LayoutGrid, CheckCircle2, ArrowUpRight, 
  Filter, ShoppingBag, Star, Zap, Info,
  AlertCircle, ChevronRight, Globe, Smartphone
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

export default function MerchantStorefront() {
  const params = useParams();
  const merchantId = params?.merchantId;
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchStoreData() {
      if (!merchantId) return;

      try {
        // 1. Rale pwofil machann nan
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', merchantId)
          .single();

        if (profErr) throw profErr;
        setMerchant(prof);

        // 2. Rale tout pwodwi ki aktif yo
        const { data: prod, error: prodErr } = await supabase
          .from('products')
          .select('*')
          .eq('owner_id', merchantId)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (prodErr) throw prodErr;
        setProducts(prod || []);

      } catch (err) {
        console.error("Erè nan chaje boutik la:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStoreData();
  }, [merchantId, supabase]);

  // FILTRAJ DINAMIK
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];
  
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-red-600" size={60} strokeWidth={3} />
      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-500 animate-pulse">H-Pay Loading...</p>
    </div>
  );

  if (!merchant) return (
    <div className="min-h-screen bg-[#06070d] text-white flex flex-col items-center justify-center p-10 text-center">
      <AlertCircle size={80} className="text-zinc-800 mb-6" />
      <h1 className="text-4xl font-black uppercase italic tracking-tighter">Boutik sa a pa <span className="text-red-600">egziste</span></h1>
      <button onClick={() => router.push('/')} className="mt-8 text-[10px] font-black uppercase tracking-widest bg-white text-black px-8 py-4 rounded-full">Retounen lakay</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white italic font-medium selection:bg-red-600 pb-32">
      
      {/* --- HERO SECTION --- */}
      <div className="relative bg-[#0d0e1a] border-b border-white/5 pt-32 pb-20 px-6 overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-red-600/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-red-600/5 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-10 md:gap-16">
            {/* Avatar pwofesyonèl */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-tr from-red-600 to-red-900 rounded-[3.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative w-44 h-44 md:w-56 md:h-56 rounded-[3.5rem] bg-black border-2 border-white/10 overflow-hidden">
                <img 
                  src={merchant?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${merchant?.full_name}`} 
                  alt={merchant?.full_name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
              </div>
            </div>

            <div className="flex-1 space-y-6 text-center md:text-left">
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <span className="bg-red-600/10 text-red-500 border border-red-600/20 px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <ShieldCheck size={14} /> Machann Sètifye
                </span>
                <span className="bg-white/5 text-zinc-400 border border-white/5 px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <ShoppingBag size={14} /> {products.length} Sèvis Disponib
                </span>
              </div>
              
              <h1 className="text-6xl md:text-9xl font-black uppercase italic tracking-tighter leading-[0.75]">
                {merchant?.full_name?.split(' ')[0]} <span className="text-red-600">Store</span>
              </h1>
              
              <p className="max-w-2xl text-zinc-500 font-bold text-sm md:text-base leading-relaxed italic">
                {merchant?.bio || `Byenveni nan boutik ofisyèl ${merchant?.full_name}. Jwenn pi bon abònman ak sèvis dijital yo isit la an sekirite.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- FILTER & SEARCH BAR --- */}
      <div className="sticky top-0 z-50 bg-[#06070d]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col lg:flex-row gap-6 items-center justify-between">
          
          {/* SEARCH */}
          <div className="relative w-full lg:max-w-md group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-red-600 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Chèche yon sèvis..." 
              className="w-full bg-[#0d0e1a] border border-white/10 rounded-2xl pl-16 pr-8 py-5 text-sm outline-none focus:border-red-600 transition-all font-bold italic"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* CATEGORY TABS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar w-full lg:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                  activeCategory === cat 
                  ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/20 scale-105' 
                  : 'bg-[#0d0e1a] border-white/5 text-zinc-500 hover:border-white/20 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'Tout Sèvis' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* --- PRODUCTS GRID --- */}
      <div className="max-w-7xl mx-auto p-6 md:p-10">
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredProducts.map((p) => (
              <div 
                key={p.id} 
                className="group relative bg-[#0d0e1a] border border-white/5 rounded-[3.5rem] overflow-hidden flex flex-col hover:border-red-600/40 transition-all duration-500 shadow-2xl"
              >
                {/* Image Header */}
                <div className="h-64 bg-zinc-900 relative overflow-hidden">
                  {p.image_url ? (
                    <img 
                      src={p.image_url} 
                      className="w-full h-full object-cover opacity-60 group-hover:scale-110 group-hover:opacity-80 transition-all duration-1000" 
                      alt={p.title}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-800">
                      <LayoutGrid size={60} strokeWidth={1} />
                    </div>
                  )}
                  
                  {/* Badge Peryòd */}
                  <div className="absolute top-8 left-8 flex flex-col gap-2">
                    <span className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border border-white/10 w-fit">
                      {p.billing_cycle === 'month' ? 'Mensyèl' : p.billing_cycle === 'year' ? 'Anyèl' : 'Peryodik'}
                    </span>
                    {p.trial_days > 0 && (
                      <span className="bg-red-600 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase italic shadow-xl w-fit">
                        {p.trial_days} JOU TRIAL
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-10 space-y-8 flex-1 flex flex-col">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2 text-red-500">
                      <Zap size={14} fill="currentColor" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{p.category}</span>
                    </div>
                    
                    <h3 className="text-3xl font-black uppercase tracking-tighter leading-tight group-hover:text-red-600 transition-colors">
                      {p.title}
                    </h3>
                    
                    <p className="text-zinc-500 text-sm font-bold leading-relaxed line-clamp-3 italic">
                      {p.description}
                    </p>

                    {/* Features Preview (si yo egziste) */}
                    {p.features && p.features.length > 0 && (
                      <div className="pt-4 space-y-2">
                        {p.features.slice(0, 3).map((feat: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-400">
                            <CheckCircle2 size={12} className="text-green-600" /> {feat}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Card */}
                  <div className="pt-10 border-t border-white/5 flex items-center justify-between mt-auto">
                    <div>
                      <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Prix Abònman</p>
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-black tracking-tighter">{p.price?.toLocaleString()}</span>
                        <span className="text-xs text-red-600 font-black mb-1 uppercase">HTG</span>
                      </div>
                    </div>
                    
                    {/* BON LYEN AN POU ACHTE A */}
                    <button 
                      onClick={() => router.push(`/subscribe/${p.id}`)}
                      className="bg-white text-black w-16 h-16 rounded-[2rem] flex items-center justify-center hover:bg-red-600 hover:text-white hover:rotate-12 hover:scale-110 transition-all duration-500 shadow-xl group/btn"
                    >
                      <ArrowUpRight size={28} className="group-hover/btn:scale-125 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-40 text-center space-y-6">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-10 border border-white/5">
              <Search size={40} className="text-zinc-700" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter">Pa gen anyen konsa <span className="text-red-600">isit la</span></h2>
            <p className="text-zinc-500 font-bold italic">Eseye chanje mo rechèch ou a oswa chanje kategori.</p>
          </div>
        )}
      </div>

      {/* --- FOOTER INFO --- */}
      <div className="max-w-7xl mx-auto px-6 mt-20">
        <div className="bg-[#0d0e1a] border border-white/5 rounded-[3.5rem] p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="space-y-4 text-center md:text-left">
            <h4 className="text-3xl font-black uppercase italic tracking-tighter">Sekirite <span className="text-red-600">H-Pay</span></h4>
            <p className="text-zinc-500 text-sm font-bold max-w-md italic">Lè ou peye yon abònman, kòb la rete nan Escrow pou sekirite ou jiskaske ou jwenn sèvis la.</p>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-center p-6 bg-black/40 rounded-[2rem] border border-white/5 w-32">
              <Smartphone className="text-red-600 mb-2" size={24} />
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">App Ready</span>
            </div>
            <div className="flex flex-col items-center p-6 bg-black/40 rounded-[2rem] border border-white/5 w-32">
              <Globe className="text-red-600 mb-2" size={24} />
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Global Pay</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}