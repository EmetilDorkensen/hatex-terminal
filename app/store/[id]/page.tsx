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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 font-sans">
      <Loader2 className="animate-spin text-indigo-600" size={48} strokeWidth={3} />
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 animate-pulse">Ap Chaje Boutik La...</p>
    </div>
  );

  if (!merchant) return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-10 text-center font-sans">
      <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm max-w-md w-full flex flex-col items-center">
        <AlertCircle size={64} className="text-rose-500 mb-6" />
        <h1 className="text-2xl font-bold tracking-tight mb-2">Boutik sa pa egziste</h1>
        <p className="text-slate-500 text-sm mb-8">Lyen ou itilize a pa valab oswa machann nan fèmen boutik li a.</p>
        <button 
          onClick={() => router.push('/')} 
          className="w-full text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-xl transition-colors shadow-sm"
        >
          Retounen nan Akey la
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-32">
      
      {/* --- HERO SECTION --- */}
      <div className="bg-white border-b border-gray-200 pt-24 pb-16 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-8 md:gap-12">
            
            {/* Avatar pwofesyonèl */}
            <div className="relative group shrink-0">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-slate-100 border-4 border-white shadow-lg overflow-hidden relative">
                <img 
                  src={merchant?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${merchant?.full_name}`} 
                  alt={merchant?.full_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            <div className="flex-1 space-y-4 text-center md:text-left">
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Machann Sètifye
                </span>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag size={14} /> {products.length} Sèvis Disponib
                </span>
              </div>
              
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900">
                {merchant?.business_name || merchant?.full_name}
              </h1>
              
              <p className="max-w-2xl text-slate-500 font-medium text-sm md:text-base leading-relaxed mx-auto md:mx-0">
                {merchant?.bio || `Byenvini nan boutik ofisyèl ${merchant?.business_name || merchant?.full_name}. Jwenn pi bon abònman ak sèvis dijital yo isit la an sekirite.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- FILTER & SEARCH BAR --- */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row gap-4 items-center justify-between">
          
          {/* SEARCH */}
          <div className="relative w-full lg:max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Chèche yon sèvis..." 
              className="w-full bg-slate-50 border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-900 placeholder:text-slate-400 shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* CATEGORY TABS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 custom-scrollbar w-full lg:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
                  activeCategory === cat 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                  : 'bg-white border-gray-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                }`}
              >
                {cat === 'all' ? 'Tout Sèvis' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* --- PRODUCTS GRID --- */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 mt-6">
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredProducts.map((p) => (
              <div 
                key={p.id} 
                className="group relative bg-white border border-gray-200 rounded-3xl overflow-hidden flex flex-col hover:border-indigo-300 hover:shadow-lg transition-all duration-300 shadow-sm"
              >
                {/* Image Header */}
                <div className="h-48 sm:h-56 bg-slate-100 relative overflow-hidden border-b border-gray-100">
                  {p.image_url ? (
                    <img 
                      src={p.image_url} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                      alt={p.title}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <LayoutGrid size={48} strokeWidth={1.5} />
                    </div>
                  )}
                  
                  {/* Badge Peryòd */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <span className="bg-white/90 backdrop-blur-md text-slate-800 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-gray-200/50 shadow-sm w-fit">
                      {p.billing_cycle === 'month' ? 'Mensyèl' : p.billing_cycle === 'year' ? 'Anyèl' : 'Peryodik'}
                    </span>
                    {p.trial_days > 0 && (
                      <span className="bg-emerald-500 text-white px-3 py-1.5 rounded-md text-[10px] font-bold uppercase shadow-sm w-fit">
                        {p.trial_days} Jou Gratis
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 sm:p-8 flex-1 flex flex-col">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-1.5 text-indigo-600">
                      <Zap size={14} fill="currentColor" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{p.category}</span>
                    </div>
                    
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                      {p.title}
                    </h3>
                    
                    <p className="text-slate-500 text-sm font-medium leading-relaxed line-clamp-3">
                      {p.description}
                    </p>

                    {/* Features Preview (si yo egziste) */}
                    {p.features && p.features.length > 0 && (
                      <div className="pt-2 space-y-2.5">
                        {p.features.slice(0, 3).map((feat: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs font-semibold text-slate-600">
                            <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /> 
                            <span className="leading-tight">{feat}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Card */}
                  <div className="pt-6 mt-6 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pri Abònman</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{p.price?.toLocaleString()}</span>
                        <span className="text-xs text-slate-500 font-bold uppercase">HTG</span>
                      </div>
                    </div>
                    
                    {/* BON LYEN AN POU ACHTE A */}
                    <button 
                      onClick={() => router.push(`/subscribe/${p.id}`)}
                      className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all duration-300 shadow-sm group/btn"
                      title="Achte Kounye a"
                    >
                      <ArrowUpRight size={22} className="group-hover/btn:scale-110 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-32 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-gray-200">
              <Search size={32} className="text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Pa gen rezilta</h2>
            <p className="text-slate-500 font-medium max-w-md">Nou pa jwenn okenn sèvis ki koresponn ak rechèch ou an. Eseye yon lòt mo kle oswa chwazi yon lòt kategori.</p>
          </div>
        )}
      </div>

      {/* --- FOOTER INFO --- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-10">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
          <div className="space-y-3 text-center md:text-left">
            <h4 className="text-xl font-bold tracking-tight text-slate-900">Sekirite <span className="text-indigo-600">Hatexcard</span></h4>
            <p className="text-slate-500 text-sm font-medium max-w-md leading-relaxed">
              Lè ou peye yon abònman oswa yon sèvis, kòb la rete pwoteje nan sistèm nan pou asire w jwenn sa w achte a.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="flex flex-col items-center p-5 bg-slate-50 rounded-2xl border border-gray-100 w-28 sm:w-32">
              <Smartphone className="text-indigo-500 mb-2" size={24} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">App Ready</span>
            </div>
            <div className="flex flex-col items-center p-5 bg-slate-50 rounded-2xl border border-gray-100 w-28 sm:w-32">
              <Globe className="text-indigo-500 mb-2" size={24} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Global Pay</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}