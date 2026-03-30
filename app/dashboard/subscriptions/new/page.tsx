"use client";

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ArrowLeft, Save, Loader2, Image as ImageIcon, CheckCircle2, 
  Globe, Lock, Zap, Star, LayoutGrid, CreditCard, Heart, 
  Gamepad2, Utensils, Wrench, Briefcase, Camera, Music, ShoppingBag,
  Plus, Trash2, Sparkles, ShieldCheck, ZapOff,
  HelpCircle, Phone, LockKeyhole, UploadCloud
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
  { id: 'entertainment', name: 'Divertisman', icon: <Zap className="w-5 h-5"/>, desc: 'Netflix, IPTV, Streaming' },
  { id: 'education', name: 'Edikasyon', icon: <Globe className="w-5 h-5"/>, desc: 'Kou anliy, Liv, Training' },
  { id: 'software', name: 'Lojisyèl / SaaS', icon: <Lock className="w-5 h-5"/>, desc: 'Apps, Web Tools, Hosting' },
  { id: 'gaming', name: 'Gaming / FiveM', icon: <Gamepad2 className="w-5 h-5"/>, desc: 'Servers, Coins, Skins' },
  { id: 'nutrition', name: 'Sante & Nitrisyon', icon: <Utensils className="w-5 h-5"/>, desc: 'Pwoteyin, Rejim, Gym' },
  { id: 'fitness', name: 'Fitness / Coach', icon: <Star className="w-5 h-5"/>, desc: 'Antrenman, Swivi pèsonèl' },
  { id: 'content', name: 'Kreyasyon Kontni', icon: <Camera className="w-5 h-5"/>, desc: 'OnlyFans, Patreon, VIP' },
  { id: 'music', name: 'Mizik & Audio', icon: <Music className="w-5 h-5"/>, desc: 'Beats, Studio, Playlists' },
  { id: 'professional', name: 'Sèvis Pwofesyonèl', icon: <Briefcase className="w-5 h-5"/>, desc: 'Konsiltasyon, Legal' },
  { id: 'tools', name: 'Zouti Teknik', icon: <Wrench className="w-5 h-5"/>, desc: 'Reparasyon, Devlopman' },
  { id: 'lifestyle', name: 'Style de Vi', icon: <Heart className="w-5 h-5"/>, desc: 'Fashion, Vwayaj, Evènman' },
  { id: 'shopping', name: 'E-commerce', icon: <ShoppingBag className="w-5 h-5"/>, desc: 'Boutik anliy, Pwodwi fizik' },
  { id: 'crypto', name: 'Trading / Crypto', icon: <ZapOff className="w-5 h-5"/>, desc: 'Signals, Kou Trading' },
  { id: 'other', name: 'Lòt Sèvis', icon: <LayoutGrid className="w-5 h-5"/>, desc: 'Nenpòt lòt bagay' }
];

export default function NewSubscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // STATE POU FOTO NAN GALERI A
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: 'entertainment',
    billing_cycle: 'month',
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

  // FONKSYON LÈ MACHANN NAN CHWAZI FOTO A NAN GALERI A
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file)); // Montre foto a dirèk nan preview a
    }
  };

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
          throw new Error("Ou dwe mete yon nimewo WhatsApp/Kontak valid.");
      }

      let finalImageUrl = '';

      // SI MACHANN NAN TE CHWAZI YON FOTO, VOYEL NAN SUPABASE STORAGE
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('products') // ⚠️ Asire w ou gen yon bucket ki rele 'products' anndan Supabase!
          .upload(filePath, imageFile);

        if (uploadError) throw new Error("Erè nan chaje foto a. Tcheke si bucket 'products' la kreye nan Supabase.");

        const { data: publicUrlData } = supabase.storage
          .from('products')
          .getPublicUrl(filePath);

        finalImageUrl = publicUrlData.publicUrl;
      }

      const { error } = await supabase.from('products').insert([{
        owner_id: user.id,
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price || '0'),
        category: formData.category,
        billing_cycle: formData.billing_cycle,
        image_url: finalImageUrl,
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
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" /> ANILE KREYASYON
            </button>
            <h1 className="text-4xl sm:text-6xl lg:text-8xl xl:text-9xl font-black uppercase italic tracking-tighter leading-[0.85] md:leading-[0.8]">
              PUBLISH <span className="text-red-600 block sm:inline">NEW</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-3 md:gap-4 bg-[#0d0e1a] p-3 md:p-4 rounded-2xl md:rounded-3xl border border-white/5 shadow-2xl w-full md:w-auto justify-center md:justify-end">
             <div className="px-4 md:px-8 py-2 md:py-3 bg-red-600 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 w-full sm:w-auto justify-center">
               <ShieldCheck className="w-4 h-4" /> VERIFIED
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-20">
          
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-12 md:space-y-20">
            {/* ETAP 1 */}
            <section className="space-y-6 md:space-y-10">
              <div className="flex items-center gap-3 md:gap-5">
                <span className="text-4xl md:text-6xl font-black text-red-600/20">01</span>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest italic leading-tight">Idantite <span className="text-red-600">& Foto</span></h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10">
                <div className="space-y-3 md:space-y-4">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Non Abònman an *</label>
                  <input required type="text" placeholder="Ex: Premium VIP" className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-sm outline-none focus:border-red-600 font-bold" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                </div>
                
                {/* UPLOAD FOTO NAN GALERI A */}
                <div className="space-y-3 md:space-y-4">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Chwazi Foto nan Galeri *</label>
                  <label className="flex flex-col items-center justify-center w-full h-full min-h-[100px] bg-[#0d0e1a] border-2 border-dashed border-white/10 rounded-[2rem] hover:border-red-600/50 transition-all cursor-pointer group p-4">
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} required />
                    <UploadCloud className="text-zinc-500 mb-2 group-hover:text-red-500 transition-colors w-6 h-6 md:w-8 md:h-8" />
                    <span className="text-[9px] md:text-[10px] font-black uppercase text-zinc-400 group-hover:text-white text-center">
                      {imageFile ? <span className="text-green-500">Foto a chwazi ✓</span> : 'Klike isit la pou w chèche'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em]">Deskripsyon Detaye</label>
                <textarea rows={5} placeholder="Poukisa kliyan an dwe achte sa?" className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 text-sm outline-none focus:border-red-600 resize-none font-medium leading-relaxed" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
            </section>

            {/* ETAP 2 */}
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

            {/* ETAP 3 */}
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

              {/* KONTAK AK SEKIRITE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 bg-black/40 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-white/5">
                <div className="space-y-3 md:space-y-4">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em] flex items-center gap-2">
                    <Phone className="w-4 h-4 text-red-600" /> WhatsApp / Telefòn *
                  </label>
                  {/* NIMEWO A OBLIGATWA */}
                  <input required type="tel" placeholder="+509..." className="w-full bg-[#0d0e1a] border border-white/5 rounded-[2rem] p-5 md:p-6 text-sm font-bold outline-none focus:border-red-600 transition-all placeholder:text-zinc-700" value={formData.contact_phone} onChange={(e) => setFormData({...formData, contact_phone: e.target.value})} />
                  <p className="text-[8px] text-zinc-500 italic ml-4">Mete kòd peyi a (+509). Li obligatwa pou resi WhatsApp la.</p>
                </div>
                
                <div className="space-y-3 md:space-y-4 flex flex-col justify-center">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-600 ml-4 tracking-[0.2em] flex items-center gap-2">
                    <LockKeyhole className="w-4 h-4 text-green-500" /> Opsyon Sekirite
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

          {/* PREVIEW FIXED */}
          <div className="xl:col-span-5 relative order-first xl:order-last mb-10 xl:mb-0">
            <div className="xl:sticky xl:top-12 space-y-6 md:space-y-10">
              <div className="flex items-center justify-center gap-3 md:gap-4 text-zinc-700">
                <div className="h-[1px] w-8 md:w-12 bg-zinc-800" />
                <h3 className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] italic text-center">Storefront Preview</h3>
                <div className="h-[1px] w-8 md:w-12 bg-zinc-800" />
              </div>
              
              <div className="bg-[#0d0e1a] border border-white/5 rounded-[3rem] md:rounded-[5rem] overflow-hidden shadow-2xl group border-b-[8px] md:border-b-[12px] border-b-red-600 relative">
                
                <div className="h-[250px] sm:h-[350px] md:h-[450px] bg-zinc-900 relative">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover group-hover:scale-110 transition-all duration-[2000ms]" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-800 gap-4 md:gap-6">
                      <ImageIcon strokeWidth={1} className="opacity-20 w-16 h-16 md:w-24 md:h-24" />
                      <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] opacity-40">Awaiting Banner</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e1a] via-[#0d0e1a]/20 to-transparent" />
                  
                  <div className="absolute top-6 md:top-12 left-6 md:left-12 flex flex-col gap-2 md:gap-3">
                    <div className="bg-black/60 backdrop-blur-xl px-4 md:px-6 py-2 md:py-3 rounded-full text-[8px] md:text-[10px] font-black uppercase italic border border-white/10 shadow-2xl w-fit">
                      {formData.billing_cycle === 'month' ? 'Plan Mensyèl' : formData.billing_cycle === 'year' ? 'Plan Anyèl' : 'Abònman'}
                    </div>
                  </div>
                </div>

                <div className="p-8 sm:p-10 md:p-16 space-y-8 md:space-y-12 relative z-10 -mt-10 sm:-mt-16 md:mt-0">
                  <div className="space-y-3 md:space-y-5">
                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter leading-none break-words">{formData.title || "TIT SÈVIS OU"}</h2>
                  </div>

                  <p className="text-zinc-500 text-xs sm:text-sm md:text-base font-bold leading-relaxed line-clamp-3 italic border-l-2 md:border-l-4 border-red-600/20 pl-4 md:pl-6">
                    {formData.description || "Deskripsyon an ap parèt isit la pou kliyan ou yo."}
                  </p>

                  <div className="bg-black/60 backdrop-blur-3xl p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border border-white/5 flex flex-col gap-2 md:gap-3 shadow-inner">
                    <span className="text-[8px] md:text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em] md:tracking-[0.4em]">Net Payable Amount</span>
                    <div className="flex items-end gap-2 md:gap-3">
                       <span className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter text-white truncate">{(parseFloat(formData.price) || 0).toLocaleString()}</span>
                       <span className="text-xl md:text-2xl font-black text-red-600 mb-1 md:mb-2 italic">HTG</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}