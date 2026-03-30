"use client";

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ArrowLeft, Save, Loader2, Image as ImageIcon, CheckCircle2, 
  Globe, Lock, Zap, Star, LayoutGrid, CreditCard, Heart, 
  Gamepad2, Utensils, Wrench, Briefcase, Camera, Music, ShoppingBag,
  Plus, Trash2, Sparkles, ShieldCheck, ZapOff,
  HelpCircle, Phone, LockKeyhole, Settings2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// LIS KATEGORI KONPLÈ AK DESKRIPSYON YO
const CATEGORIES = [
  { id: 'entertainment', name: 'Divertisman', icon: <Zap className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'Netflix, IPTV, Streaming' },
  { id: 'education', name: 'Edikasyon', icon: <Globe className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'Kou anliy, Liv, Training' },
  { id: 'software', name: 'Lojisyèl / SaaS', icon: <Lock className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'Apps, Web Tools, Hosting' },
  { id: 'gaming', name: 'Gaming / FiveM', icon: <Gamepad2 className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'Servers, Coins, Skins' },
  { id: 'nutrition', name: 'Sante & Nitrisyon', icon: <Utensils className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'Pwoteyin, Rejim, Gym' },
  { id: 'fitness', name: 'Fitness / Coach', icon: <Star className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'Antrenman, Swivi pèsonèl' },
  { id: 'content', name: 'Kreyasyon Kontni', icon: <Camera className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'OnlyFans, Patreon, VIP' },
  { id: 'music', name: 'Mizik & Audio', icon: <Music className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'Beats, Studio, Playlists' },
  { id: 'professional', name: 'Sèvis Pwofesyonèl', icon: <Briefcase className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'Konsiltasyon, Legal' },
  { id: 'tools', name: 'Zouti Teknik', icon: <Wrench className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'Reparasyon, Devlopman' },
  { id: 'lifestyle', name: 'Style de Vi', icon: <Heart className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'Fashion, Vwayaj, Evènman' },
  { id: 'shopping', name: 'E-commerce', icon: <ShoppingBag className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'Boutik anliy, Pwodwi fizik' },
  { id: 'crypto', name: 'Trading / Crypto', icon: <ZapOff className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'Signals, Kou Trading' },
  { id: 'other', name: 'Lòt Sèvis', icon: <LayoutGrid className="w-4 h-4 md:w-5 md:h-5"/>, desc: 'Nenpòt lòt bagay' }
];

export default function NewSubscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // DONE FÒMILÈ A AK TOUT OPSYON YO
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: 'entertainment',
    billing_cycle: 'month',
    image_url: '',
    contact_phone: '',
    encrypt_price: false,
    features: ['', '', ''],
    trial_days: '0',
    status: 'active',
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ou dwe konekte kòm machann");

      if (!formData.contact_phone || formData.contact_phone.length < 8) {
          throw new Error("Ou dwe mete yon nimewo WhatsApp/Kontak valid (omwen 8 chif).");
      }

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
        contact_phone: formData.contact_phone,
        encrypt_price: formData.encrypt_price,
        status: 'active'
      }]);

      if (error) throw error;

      router.push(`/store/${user.id}`);
      router.refresh();
    } catch (err: any) {
      alert("Erè: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 md:p-8 lg:p-12 italic font-medium selection:bg-red-600">
      <div className="max-w-[1400px] mx-auto space-y-8 md:space-y-12 pb-20">
        
        {/* HEADER AK NAVIGASYON */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8 border-b border-white/5 pb-8 md:pb-10">
          <div className="space-y-4 md:space-y-6">
            <button onClick={() => router.back()} className="flex items-center gap-2 md:gap-3 text-[10px] md:text-[12px] font-black uppercase text-zinc-500 hover:text-white transition-all tracking-[0.4em]">
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" /> ANILE KREYASYON AN
            </button>
            <h1 className="text-4xl sm:text-6xl lg:text-8xl xl:text-9xl font-black uppercase italic tracking-tighter leading-[0.85] md:leading-[0.8]">
              PUBLISH <span className="text-red-600 block sm:inline">NEW</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-3 md:gap-4 bg-[#0d0e1a] p-3 md:p-4 rounded-2xl md:rounded-3xl border border-white/5 shadow-2xl w-full md:w-auto justify-center md:justify-end">
             <div className="px-4 md:px-8 py-2 md:py-3 bg-red-600 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 w-full sm:w-auto justify-center">
               <ShieldCheck className="w-4 h-4" /> MERCHANT VERIFIED
             </div>
             <div className="px-4 md:px-8 py-2 md:py-3 bg-zinc-900 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500 border border-white/5 hidden sm:block">
               H-PAY ENGINE V2
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-20">
          
          {/* FÒMILÈ A */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-12 md:space-y-20">
            
            {/* ETAP 1: IDANTITE AK FOTO */}
            <section className="space-y-6 md:space-y-10">
              <div className="flex items-center gap-3 md:gap-5">
                <span className="text-4xl md:text-6xl font-black text-red-600/20">01</span>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest italic leading-tight">Idantite <span className="text-red-600">& Foto</span></h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10">
                <div className="space-y-3 md:space-y-4">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Non Abònman an *</label>
                  <input required type="text" placeholder="Ex: Premium VIP 4K" className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-sm outline-none focus:border-red-600 transition-all font-bold placeholder:text-zinc-800" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="space-y-3 md:space-y-4">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Lyen Cover Image (Opsyonèl)</label>
                  <input type="url" placeholder="https://..." className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-sm outline-none focus:border-red-600 transition-all font-bold placeholder:text-zinc-800" value={formData.image_url} onChange={(e) => setFormData({...formData, image_url: e.target.value})} />
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Deskripsyon Detaye</label>
                <textarea rows={4} placeholder="Poukisa kliyan an dwe achte sa nan men w? Ekri yon bon deskripsyon ki kapte atansyon..." className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 text-sm outline-none focus:border-red-600 transition-all resize-none font-medium leading-relaxed" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
            </section>

            {/* ETAP 2: KATEGORI */}
            <section className="space-y-6 md:space-y-10">
              <div className="flex items-center gap-3 md:gap-5">
                <span className="text-4xl md:text-6xl font-black text-red-600/20">02</span>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest italic leading-tight">Chwazi <span className="text-red-600">Kategori</span></h2>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {CATEGORIES.map((cat) => (
                  <button key={cat.id} type="button" onClick={() => setFormData({...formData, category: cat.id})} className={`flex flex-col items-center justify-center text-center p-4 md:p-6 lg:p-8 rounded-[2rem] md:rounded-[3rem] border transition-all duration-300 group ${formData.category === cat.id ? 'border-red-600 bg-red-600 text-white scale-[1.02] shadow-xl shadow-red-600/20' : 'border-white/5 bg-[#0d0e1a] text-zinc-600 hover:border-white/10'}`}>
                    <div className={`${formData.category === cat.id ? 'text-white' : 'text-red-600'} mb-2 md:mb-4 group-hover:scale-110 transition-transform`}>
                      {cat.icon}
                    </div>
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-tighter leading-tight">{cat.name}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* ETAP 3: TARIF, KONTAK & SEKIRITE */}
            <section className="space-y-6 md:space-y-10">
              <div className="flex items-center gap-3 md:gap-5">
                <span className="text-4xl md:text-6xl font-black text-red-600/20">03</span>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest italic leading-tight">Prix, Kontak <span className="text-red-600">& Benefis</span></h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                <div className="space-y-3 md:space-y-4">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Pri (HTG) *</label>
                  <div className="relative">
                    <input required type="number" placeholder="0.00" className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-2xl md:text-4xl font-black outline-none focus:border-red-600 text-red-600 shadow-inner" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                    <span className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 text-[10px] md:text-xs font-black uppercase opacity-20">HTG</span>
                  </div>
                </div>
                <div className="space-y-3 md:space-y-4">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Sik Peman *</label>
                  <select className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-[10px] md:text-[11px] font-black uppercase outline-none focus:border-red-600 appearance-none cursor-pointer" value={formData.billing_cycle} onChange={(e) => setFormData({...formData, billing_cycle: e.target.value})}>
                    <option value="day">Chak Jou</option>
                    <option value="week">Chak Semèn</option>
                    <option value="month">Chak Mwa</option>
                    <option value="year">Chak Ane</option>
                  </select>
                </div>
                <div className="space-y-3 md:space-y-4 sm:col-span-2 lg:col-span-1">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Trial (Jou)</label>
                  <input type="number" placeholder="0" className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-xl md:text-2xl font-black outline-none focus:border-red-600 transition-all" value={formData.trial_days} onChange={(e) => setFormData({...formData, trial_days: e.target.value})} />
                </div>
              </div>

              {/* KONTAK AK SEKIRITE (NOUVO) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 bg-black/40 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-white/5">
                <div className="space-y-3 md:space-y-4">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em] flex items-center gap-2">
                    <Phone className="text-red-600 w-3.5 h-3.5 md:w-4 md:h-4" /> WhatsApp / Telefòn *
                  </label>
                  <input required type="tel" placeholder="+509..." className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2rem] p-5 md:p-6 text-sm font-bold outline-none focus:border-red-600 transition-all placeholder:text-zinc-700" value={formData.contact_phone} onChange={(e) => setFormData({...formData, contact_phone: e.target.value})} />
                  <p className="text-[8px] text-zinc-500 italic ml-4">Obligatwa pou kliyan ka kontakte w.</p>
                </div>
                
                <div className="space-y-3 md:space-y-4 flex flex-col justify-center">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em] flex items-center gap-2">
                    <LockKeyhole className="text-green-500 w-3.5 h-3.5 md:w-4 md:h-4" /> Opsyon Sekirite
                  </label>
                  <label className="flex items-center gap-4 cursor-pointer p-5 md:p-6 rounded-[2rem] bg-[#0d0e1a] border border-white/5 hover:border-red-600/50 transition-all">
                    <input type="checkbox" className="w-5 h-5 accent-red-600 rounded-md" checked={formData.encrypt_price} onChange={(e) => setFormData({...formData, encrypt_price: e.target.checked})} />
                    <span className="text-[10px] md:text-[11px] font-black uppercase text-zinc-300">Kripte ID nan Lyen an</span>
                  </label>
                </div>
              </div>

              {/* FEATURES */}
              <div className="space-y-4 md:space-y-6">
                <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Lis Avantaj / Features (Kisa kliyan ap jwenn?)</label>
                <div className="grid grid-cols-1 gap-3 md:gap-4">
                  {formData.features.map((feature, idx) => (
                    <div key={idx} className="flex gap-3 md:gap-4 group items-center">
                      <div className="flex-1 relative">
                        <CheckCircle2 className="w-4 h-4 absolute left-5 md:left-8 top-1/2 -translate-y-1/2 text-green-600 opacity-50 group-focus-within:opacity-100" />
                        <input type="text" placeholder="Ex: Aksè 4K Ultra HD" className="w-full bg-[#0d0e1a] border border-white/5 rounded-full md:rounded-[2rem] pl-12 md:pl-16 pr-6 md:pr-8 py-4 md:py-6 text-[10px] md:text-[11px] outline-none focus:border-red-600 font-bold italic" value={feature} onChange={(e) => handleFeatureChange(idx, e.target.value)} />
                      </div>
                      <button type="button" onClick={() => removeFeature(idx)} className="p-4 md:p-6 bg-red-600/5 text-red-600 rounded-full md:rounded-[1.5rem] border border-red-600/10 hover:bg-red-600 hover:text-white transition-all shadow-xl shrink-0">
                        <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addFeature} className="w-full py-4 md:py-6 border-2 border-dashed border-white/5 rounded-full md:rounded-[2rem] text-[9px] md:text-[10px] font-black uppercase text-zinc-600 hover:border-red-600/40 hover:text-red-600 transition-all flex items-center justify-center gap-2 md:gap-3 italic mt-2">
                    <Plus className="w-4 h-4" /> Ajoute yon lòt benefis
                  </button>
                </div>
              </div>
            </section>

            <button type="submit" disabled={loading} className="w-full bg-white text-black py-8 md:py-12 rounded-full md:rounded-[4rem] font-black uppercase text-[12px] md:text-[18px] tracking-[0.4em] md:tracking-[0.6em] hover:bg-red-600 hover:text-white hover:scale-[1.02] active:scale-95 transition-all shadow-lg md:shadow-[0_30px_60px_-15px_rgba(255,0,0,0.3)] flex items-center justify-center gap-4 md:gap-6 disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin w-6 h-6 md:w-10 md:h-10" /> : <><Save className="w-6 h-6 md:w-10 md:h-10" /> Pibliye Abònman</>}
            </button>
          </form>

          {/* PREVIEW FIXED (DWAT) */}
          <div className="xl:col-span-5 relative order-first xl:order-last mb-10 xl:mb-0">
            <div className="xl:sticky xl:top-12 space-y-6 md:space-y-10">
              <div className="flex items-center justify-center gap-3 md:gap-4 text-zinc-700">
                <div className="h-[1px] w-8 md:w-12 bg-zinc-800" />
                <h3 className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] italic text-center">Storefront Preview <br className="sm:hidden"/>(Mobil & Desktop)</h3>
                <div className="h-[1px] w-8 md:w-12 bg-zinc-800" />
              </div>
              
              <div className="bg-[#0d0e1a] border border-white/5 rounded-[3rem] md:rounded-[5rem] overflow-hidden shadow-2xl group border-b-[8px] md:border-b-[12px] border-b-red-600 relative">
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                
                <div className="h-[250px] sm:h-[350px] md:h-[450px] bg-zinc-900 relative">
                  {formData.image_url ? (
                    <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover group-hover:scale-110 transition-all duration-[2000ms]" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-800 gap-4 md:gap-6">
                      <ImageIcon strokeWidth={1} className="opacity-20 w-16 h-16 md:w-[100px] md:h-[100px]" />
                      <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] opacity-40">Awaiting Banner</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e1a] via-[#0d0e1a]/20 to-transparent" />
                  
                  {/* Badges nan preview */}
                  <div className="absolute top-6 md:top-12 left-6 md:left-12 flex flex-col gap-2 md:gap-3">
                    <div className="bg-black/60 backdrop-blur-xl px-4 md:px-6 py-2 md:py-3 rounded-full text-[8px] md:text-[10px] font-black uppercase italic border border-white/10 shadow-2xl w-fit">
                      {formData.billing_cycle === 'month' ? 'Plan Mensyèl' : formData.billing_cycle === 'year' ? 'Plan Anyèl' : 'Abònman'}
                    </div>
                    {parseInt(formData.trial_days) > 0 && (
                      <div className="bg-red-600 px-4 md:px-6 py-2 md:py-3 rounded-full text-[8px] md:text-[10px] font-black uppercase italic shadow-2xl animate-pulse w-fit">
                        {formData.trial_days} JOU TRIAL
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-8 sm:p-10 md:p-16 space-y-8 md:space-y-12 relative z-10 -mt-10 sm:-mt-16 md:mt-0">
                  <div className="space-y-3 md:space-y-5">
                    <div className="flex items-center gap-2 md:gap-3 text-red-500">
                       <Sparkles fill="currentColor" className="w-3.5 h-3.5 md:w-4 md:h-4" />
                       <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em]">{formData.category}</span>
                    </div>
                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter leading-none break-words">{formData.title || "TIT SÈVIS OU"}</h2>
                  </div>

                  <p className="text-zinc-500 text-xs sm:text-sm md:text-base font-bold leading-relaxed line-clamp-3 md:line-clamp-4 italic border-l-2 md:border-l-4 border-red-600/20 pl-4 md:pl-6">
                    {formData.description || "Deskripsyon an ap parèt isit la pou kliyan ou yo."}
                  </p>

                  <div className="space-y-3 md:space-y-5">
                    {formData.features.filter(f => f !== '').slice(0, 3).map((f, i) => (
                      <div key={i} className="flex items-center gap-3 md:gap-4 text-white text-[10px] md:text-[12px] font-black uppercase italic">
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-red-600/20 flex items-center justify-center border border-red-600/30 shrink-0">
                          <CheckCircle2 className="text-red-600 w-3 h-3 md:w-3.5 md:h-3.5" />
                        </div>
                        <span className="truncate">{f}</span>
                      </div>
                    ))}
                    {formData.features.filter(f => f !== '').length > 3 && (
                       <p className="text-[9px] text-zinc-500 italic pl-10">+ lòt benefis...</p>
                    )}
                  </div>

                  <div className="bg-black/60 backdrop-blur-3xl p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border border-white/5 flex flex-col gap-2 md:gap-3 shadow-inner">
                    <span className="text-[8px] md:text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em] md:tracking-[0.4em]">Net Payable Amount</span>
                    <div className="flex items-end gap-2 md:gap-3">
                       <span className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter text-white truncate">{(parseFloat(formData.price) || 0).toLocaleString()}</span>
                       <span className="text-xl md:text-2xl font-black text-red-600 mb-1 md:mb-2 italic">HTG</span>
                    </div>
                  </div>

                  {/* INFO KONTAK NAN PREVIEW */}
                  {formData.contact_phone && (
                     <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                        <Phone className="text-green-500 w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="text-[10px] font-black text-zinc-400">Kontak: {formData.contact_phone}</span>
                     </div>
                  )}

                  <div className="flex flex-col items-center gap-4 md:gap-6 pt-6 md:pt-10 border-t border-white/5">
                     <div className="flex items-center gap-2 md:gap-3 text-[8px] md:text-[10px] text-zinc-700 font-black uppercase tracking-[0.2em] md:tracking-[0.4em] text-center">
                        <ShieldCheck className="text-green-600 w-4 h-4 md:w-5 md:h-5" /> SECURED BY H-PAY ESCROW
                     </div>
                  </div>
                </div>
              </div>

              {/* TIPS KACHE SOU TELEFÒN POU PA PRAN ESPAS */}
              <div className="hidden sm:flex bg-red-600/5 border border-red-600/10 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] gap-4 md:gap-6 items-start">
                 <HelpCircle className="text-red-600 shrink-0 w-5 h-5 md:w-6 md:h-6" />
                 <p className="text-[9px] md:text-[10px] text-zinc-500 leading-relaxed font-bold italic">
                   <span className="text-white block mb-1 uppercase">Pro Tip:</span>
                   Mete yon bon imaj ak yon nimewo WhatsApp valid pou kliyan yo fè w konfyans pi vit. Lè "Kripte Pri" aktive, URL la ap kache detay yo.
                 </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}