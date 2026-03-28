"use client";

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ArrowLeft, Save, Loader2, Image as ImageIcon, CheckCircle2, 
  Globe, Lock, Zap, Star, LayoutGrid, CreditCard, Heart, 
  Gamepad2, Utensils, Wrench, Briefcase, Camera, Music, ShoppingBag,
  Plus, Trash2, Info, Sparkles, ShieldCheck, ZapOff, AlertTriangle,
  Settings2, BarChart3, HelpCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// LIS KATEGORI KONPLÈ AK IKÒN YO
const CATEGORIES = [
  { id: 'entertainment', name: 'Divertisman', icon: <Zap size={18}/>, desc: 'Netflix, IPTV, Streaming' },
  { id: 'education', name: 'Edikasyon', icon: <Globe size={18}/>, desc: 'Kou anliy, Liv, Training' },
  { id: 'software', name: 'Lojisyèl / SaaS', icon: <Lock size={18}/>, desc: 'Apps, Web Tools, Hosting' },
  { id: 'gaming', name: 'Gaming / FiveM', icon: <Gamepad2 size={18}/>, desc: 'Servers, Coins, Skins' },
  { id: 'nutrition', name: 'Sante & Nitrisyon', icon: <Utensils size={18}/>, desc: 'Pwoteyin, Rejim, Gym' },
  { id: 'fitness', name: 'Fitness / Coach', icon: <Star size={18}/>, desc: 'Antrenman, Swivi pèsonèl' },
  { id: 'content', name: 'Kreyasyon Kontni', icon: <Camera size={18}/>, desc: 'OnlyFans, Patreon, VIP' },
  { id: 'music', name: 'Mizik & Audio', icon: <Music size={18}/>, desc: 'Beats, Studio, Playlists' },
  { id: 'professional', name: 'Sèvis Pwofesyonèl', icon: <Briefcase size={18}/>, desc: 'Konsiltasyon, Legal' },
  { id: 'tools', name: 'Zouti Teknik', icon: <Wrench size={18}/>, desc: 'Reparasyon, Devlopman' },
  { id: 'lifestyle', name: 'Style de Vi', icon: <Heart size={18}/>, desc: 'Fashion, Vwayaj, Evènman' },
  { id: 'shopping', name: 'E-commerce', icon: <ShoppingBag size={18}/>, desc: 'Boutik anliy, Pwodwi fizik' },
  { id: 'crypto', name: 'Trading / Crypto', icon: <ZapOff size={18}/>, desc: 'Signals, Kou Trading' },
  { id: 'other', name: 'Lòt Sèvis', icon: <LayoutGrid size={18}/>, desc: 'Nenpòt lòt bagay' }
];

export default function NewSubscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  
  // DONE FÒMILÈ A
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: 'entertainment',
    billing_cycle: 'month',
    image_url: '',
    features: ['', '', ''],
    trial_days: '0',
    status: 'active',
    is_featured: false
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // JENERE BENEFIS YO
  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  const addFeature = () => setFormData({ ...formData, features: [...formData.features, ''] });
  const removeFeature = (index: number) => {
    if (formData.features.length > 1) {
      const newFeatures = formData.features.filter((_, i) => i !== index);
      setFormData({ ...formData, features: newFeatures });
    }
  };

  // SOVE DONE YO
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ou dwe konekte kòm machann");

      const { error } = await supabase.from('products').insert([{
        owner_id: user.id,
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price || '0'),
        category: formData.category,
        billing_cycle: formData.billing_cycle,
        image_url: formData.image_url,
        features: formData.features.filter(f => f.trim() !== ''),
        trial_days: parseInt(formData.trial_days),
        status: 'active'
      }]);

      if (error) throw error;

      // REDIRECT SOU PAJ STORE LA
      router.push(`/store/${user.id}`);
      router.refresh();
    } catch (err: any) {
      alert("Erè: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 md:p-12 italic font-medium selection:bg-red-600">
      <div className="max-w-[1400px] mx-auto space-y-12 pb-20">
        
        {/* HEADER AK NAVIGASYON */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-10">
          <div className="space-y-6">
            <button onClick={() => router.back()} className="flex items-center gap-3 text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-all tracking-[0.4em]">
              <ArrowLeft size={18} /> ANILE KREYASYON
            </button>
            <h1 className="text-6xl md:text-9xl font-black uppercase italic tracking-tighter leading-[0.8]">
              PUBLISH <span className="text-red-600">NEW</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-4 bg-[#0d0e1a] p-4 rounded-3xl border border-white/5 shadow-2xl">
             <div className="px-8 py-3 bg-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
               <ShieldCheck size={14} /> MERCHANT VERIFIED
             </div>
             <div className="px-8 py-3 bg-zinc-900 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 border border-white/5">
               H-PAY ENGINE V2
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-20">
          
          {/* FÒMILÈ (LÈF) */}
          <form onSubmit={handleSubmit} className="xl:col-span-7 space-y-20">
            
            {/* ETAP 1: IDANTITE */}
            <section className="space-y-10">
              <div className="flex items-center gap-5">
                <span className="text-6xl font-black text-red-600/20">01</span>
                <h2 className="text-2xl font-black uppercase tracking-widest italic">Idantite <span className="text-red-600">Sèvis la</span></h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Non Abònman an</label>
                  <input required type="text" placeholder="Ex: Netflix VIP Premium" className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] p-8 text-sm outline-none focus:border-red-600 transition-all font-bold placeholder:text-zinc-800" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Lyen Cover Image</label>
                  <input type="url" placeholder="https://..." className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] p-8 text-sm outline-none focus:border-red-600 transition-all font-bold placeholder:text-zinc-800" value={formData.image_url} onChange={(e) => setFormData({...formData, image_url: e.target.value})} />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Deskripsyon Detaye</label>
                <textarea rows={5} placeholder="Poukisa kliyan an dwe achte sa nan menw?" className="w-full bg-[#0d0e1a] border border-white/5 rounded-[3rem] p-10 text-sm outline-none focus:border-red-600 transition-all resize-none font-medium leading-relaxed" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
            </section>

            {/* ETAP 2: KATEGORI AGRESYF */}
            <section className="space-y-10">
              <div className="flex items-center gap-5">
                <span className="text-6xl font-black text-red-600/20">02</span>
                <h2 className="text-2xl font-black uppercase tracking-widest italic">Chwazi <span className="text-red-600">Kategori</span></h2>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {CATEGORIES.map((cat) => (
                  <button key={cat.id} type="button" onClick={() => setFormData({...formData, category: cat.id})} className={`flex flex-col items-center text-center p-8 rounded-[3rem] border transition-all duration-500 group ${formData.category === cat.id ? 'border-red-600 bg-red-600 text-white scale-105 shadow-2xl shadow-red-600/20' : 'border-white/5 bg-[#0d0e1a] text-zinc-600 hover:border-white/10'}`}>
                    <div className={`${formData.category === cat.id ? 'text-white' : 'text-red-600'} mb-4 group-hover:scale-125 transition-transform`}>
                      {cat.icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-tighter leading-tight">{cat.name}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* ETAP 3: TARIF & BENEFIS */}
            <section className="space-y-10">
              <div className="flex items-center gap-5">
                <span className="text-6xl font-black text-red-600/20">03</span>
                <h2 className="text-2xl font-black uppercase tracking-widest italic">Prix <span className="text-red-600">& Benefis</span></h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Pri (HTG)</label>
                  <div className="relative">
                    <input required type="number" placeholder="0.00" className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] p-8 text-4xl font-black outline-none focus:border-red-600 text-red-600 shadow-inner" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                    <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs font-black uppercase opacity-20">HTG</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Sik Peman</label>
                  <select className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] p-8 text-[11px] font-black uppercase outline-none focus:border-red-600 appearance-none cursor-pointer" value={formData.billing_cycle} onChange={(e) => setFormData({...formData, billing_cycle: e.target.value})}>
                    <option value="day">Chak Jou</option>
                    <option value="week">Chak Semèn</option>
                    <option value="month">Chak Mwa</option>
                    <option value="year">Chak Ane</option>
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Trial (Jou)</label>
                  <input type="number" placeholder="0" className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] p-8 text-2xl font-black outline-none focus:border-red-600 transition-all" value={formData.trial_days} onChange={(e) => setFormData({...formData, trial_days: e.target.value})} />
                </div>
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Lis Avantaj / Features (Kisa kliyan ap jwenn?)</label>
                <div className="grid grid-cols-1 gap-4">
                  {formData.features.map((feature, idx) => (
                    <div key={idx} className="flex gap-4 group">
                      <div className="flex-1 relative">
                        <CheckCircle2 size={18} className="absolute left-8 top-1/2 -translate-y-1/2 text-green-600 opacity-50 group-focus-within:opacity-100" />
                        <input type="text" placeholder="Ex: Aksè 4K Ultra HD" className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2rem] pl-16 pr-8 py-6 text-[11px] outline-none focus:border-red-600 font-bold italic" value={feature} onChange={(e) => handleFeatureChange(idx, e.target.value)} />
                      </div>
                      <button type="button" onClick={() => removeFeature(idx)} className="p-6 bg-red-600/5 text-red-600 rounded-[1.5rem] border border-red-600/10 hover:bg-red-600 hover:text-white transition-all shadow-xl">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addFeature} className="w-full py-6 border-2 border-dashed border-white/5 rounded-[2rem] text-[10px] font-black uppercase text-zinc-600 hover:border-red-600/40 hover:text-red-600 transition-all flex items-center justify-center gap-3 italic">
                    <Plus size={18} /> Ajoute yon lòt benefis nan lis la
                  </button>
                </div>
              </div>
            </section>

            <button type="submit" disabled={loading} className="w-full bg-white text-black py-12 rounded-[4rem] font-black uppercase text-[18px] tracking-[0.6em] hover:bg-red-600 hover:text-white hover:scale-[1.02] active:scale-95 transition-all shadow-[0_30px_60px_-15px_rgba(255,0,0,0.3)] flex items-center justify-center gap-6 disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={40} /> : <><Save size={40} /> PUBLISH SUBSCRIPTION</>}
            </button>
          </form>

          {/* PREVIEW FIXED (DWAT) */}
          <div className="xl:col-span-5 relative">
            <div className="sticky top-12 space-y-10">
              <div className="flex items-center justify-center gap-4 text-zinc-700">
                <div className="h-[1px] w-12 bg-zinc-800" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.5em] italic">Storefront Preview</h3>
                <div className="h-[1px] w-12 bg-zinc-800" />
              </div>
              
              <div className="bg-[#0d0e1a] border border-white/5 rounded-[5rem] overflow-hidden shadow-2xl group border-b-[12px] border-b-red-600 relative">
                {/* Visual Glass Effect */}
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                
                <div className="h-[450px] bg-zinc-900 relative">
                  {formData.image_url ? (
                    <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover group-hover:scale-110 transition-all duration-[2000ms]" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-800 gap-6">
                      <ImageIcon size={100} strokeWidth={1} className="opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Awaiting Banner</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e1a] via-transparent to-transparent" />
                  <div className="absolute top-12 left-12 flex flex-col gap-3">
                    <div className="bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full text-[10px] font-black uppercase italic border border-white/10 shadow-2xl">
                      {formData.billing_cycle === 'month' ? 'Plan Mensyèl' : formData.billing_cycle === 'year' ? 'Plan Anyèl' : 'Abònman'}
                    </div>
                    {parseInt(formData.trial_days) > 0 && (
                      <div className="bg-red-600 px-6 py-3 rounded-full text-[10px] font-black uppercase italic shadow-2xl animate-pulse">
                        {formData.trial_days} JOU TRIAL GRATIS
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-16 space-y-12 relative z-10">
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 text-red-500">
                       <Sparkles size={16} fill="currentColor" />
                       <span className="text-[11px] font-black uppercase tracking-[0.3em]">{formData.category}</span>
                    </div>
                    <h2 className="text-6xl font-black uppercase tracking-tighter leading-none break-words">{formData.title || "TIT SÈVIS OU"}</h2>
                  </div>

                  <p className="text-zinc-500 text-sm md:text-base font-bold leading-relaxed line-clamp-4 italic border-l-4 border-red-600/20 pl-6">
                    {formData.description || "Ekri yon deskripsyon ki kaptivan isit la pou kliyan ou yo ka konnen egzakteman kisa y ap achte nan magazen H-Pay ou a."}
                  </p>

                  <div className="space-y-5">
                    {formData.features.filter(f => f !== '').map((f, i) => (
                      <div key={i} className="flex items-center gap-4 text-white text-[12px] font-black uppercase italic">
                        <div className="w-6 h-6 rounded-full bg-red-600/20 flex items-center justify-center border border-red-600/30">
                          <CheckCircle2 size={14} className="text-red-600" />
                        </div>
                        {f}
                      </div>
                    ))}
                  </div>

                  <div className="bg-black/60 backdrop-blur-3xl p-12 rounded-[4rem] border border-white/5 flex flex-col gap-3 shadow-inner">
                    <span className="text-[10px] font-black uppercase text-zinc-600 tracking-[0.4em]">Net Payable Amount</span>
                    <div className="flex items-end gap-3">
                       <span className="text-7xl font-black tracking-tighter text-white">{(parseFloat(formData.price) || 0).toLocaleString()}</span>
                       <span className="text-2xl font-black text-red-600 mb-2 italic">HTG</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-6 pt-10 border-t border-white/5">
                     <div className="flex items-center gap-3 text-[10px] text-zinc-700 font-black uppercase tracking-[0.4em]">
                        <ShieldCheck size={18} className="text-green-600" /> SECURED BY H-PAY ESCROW
                     </div>
                     <div className="flex gap-4 opacity-20 grayscale">
                        <CreditCard size={24} />
                        <LayoutGrid size={24} />
                        <Settings2 size={24} />
                     </div>
                  </div>
                </div>
              </div>

              {/* TIPS */}
              <div className="bg-red-600/5 border border-red-600/10 p-10 rounded-[3rem] flex gap-6 items-start">
                 <HelpCircle className="text-red-600 shrink-0" size={24} />
                 <p className="text-[10px] text-zinc-500 leading-relaxed font-bold italic">
                   <span className="text-white block mb-1 uppercase">Pro Tip:</span>
                   Sèvi ak imaj ki gen meyè kalite (16:9) pou fè paj ou a parèt plis pwofesyonèl epi ogmante lavant ou pa 40%.
                 </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}