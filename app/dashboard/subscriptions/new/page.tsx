"use client";

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ArrowLeft, Save, Loader2, Image as ImageIcon, 
  CheckCircle2, Globe, Lock, Zap, Star, LayoutGrid, Plus, Trash2 
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
  { id: 'entertainment', name: 'Divertisman', icon: <Zap size={14}/> },
  { id: 'education', name: 'Edikasyon', icon: <Globe size={14}/> },
  { id: 'software', name: 'Lojisyèl / SaaS', icon: <Lock size={14}/> },
  { id: 'fitness', name: 'Sante & Spò', icon: <Star size={14}/> },
  { id: 'content', name: 'Kreyasyon Kontni', icon: <ImageIcon size={14}/> },
  { id: 'other', name: 'Lòt Sèvis', icon: <LayoutGrid size={14}/> }
];

export default function NewSubscription() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: 'entertainment',
    billing_cycle: 'month',
    image_url: ''
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { error } = await supabase.from('products').insert([{
      owner_id: user.id,
      title: formData.title,
      description: formData.description,
      price: parseFloat(formData.price || '0'),
      category: formData.category,
      billing_cycle: formData.billing_cycle,
      image_url: formData.image_url,
      status: 'active'
    }]);

    if (error) {
      alert("Erè lè n ap pibliye pwodwi a: " + error.message);
      setLoading(false);
    } else {
      router.push('/dashboard/subscriptions');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-6 md:p-10 italic font-medium">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/5 pb-8">
          <button onClick={() => router.back()} className="p-4 bg-white/5 rounded-full hover:bg-white/10 transition-all border border-white/5 text-zinc-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">
              Kreye yon <span className="text-red-600">Abònman</span>
            </h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-2">
              Ranpli fòm nan pou ajoute yon nouvo sèvis nan katalòg ou
            </p>
          </div>
          <div className="w-14" /> 
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          
          {/* FÒM NAN (Gòch - 3 Kolòn) */}
          <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-8 bg-[#0d0e1a] border border-white/5 p-8 md:p-10 rounded-[3rem] shadow-2xl">
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-4 tracking-widest">Tit Abònman an *</label>
              <input 
                required
                type="text"
                placeholder="Ex: Aksè VIP, Netflix, elatriye..."
                className="w-full bg-black/40 border border-white/5 rounded-3xl p-5 text-sm outline-none focus:border-red-600 focus:bg-white/5 transition-all font-bold"
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-4 tracking-widest">Kategori Sèvis la *</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFormData({...formData, category: cat.id})}
                    className={`flex items-center gap-2 p-4 rounded-2xl border transition-all justify-center ${
                      formData.category === cat.id 
                      ? 'border-red-600 bg-red-600/10 text-red-500' 
                      : 'border-white/5 bg-black/40 text-zinc-500 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {cat.icon}
                    <span className="text-[10px] font-black uppercase tracking-wider">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-4 tracking-widest">Pri (HTG) *</label>
                <input 
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full bg-black/40 border border-white/5 rounded-3xl p-5 text-2xl font-black italic outline-none focus:border-red-600 transition-all text-red-500"
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-4 tracking-widest">Sik Faktirasyon *</label>
                <select 
                  className="w-full bg-black/40 border border-white/5 rounded-3xl p-5 text-xs font-black uppercase outline-none focus:border-red-600 appearance-none cursor-pointer"
                  onChange={(e) => setFormData({...formData, billing_cycle: e.target.value})}
                >
                  <option value="day">Chak Jou</option>
                  <option value="week">Chak Semèn</option>
                  <option value="month" selected>Chak Mwa</option>
                  <option value="year">Chak Ane</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-4 tracking-widest">Deskripsyon</label>
              <textarea 
                rows={4}
                placeholder="Bay detay sou sa kliyan an ap jwenn nan abònman sa a..."
                className="w-full bg-black/40 border border-white/5 rounded-3xl p-5 text-sm outline-none focus:border-red-600 transition-all resize-none font-medium leading-relaxed"
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-4 tracking-widest">Lyen Foto (URL)</label>
              <div className="relative">
                <ImageIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input 
                  type="url"
                  placeholder="https://egzanp.com/foto.jpg"
                  className="w-full bg-black/40 border border-white/5 rounded-3xl pl-14 pr-5 py-5 text-[11px] outline-none focus:border-red-600 transition-all font-bold tracking-widest text-zinc-300"
                  onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white py-6 rounded-[2rem] font-black uppercase text-[12px] tracking-[0.3em] hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-red-600/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? <Loader2 className="animate-spin" /> : <><Save size={20} /> Pibliye Abònman an</>}
            </button>
          </form>

          {/* PREVIEW NAN (Dwat - 2 Kolòn) */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest text-center mb-6">Aperçu pou Kliyan an</h3>
            
            <div className="bg-[#0d0e1a] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl sticky top-10 group">
              <div className="h-56 bg-zinc-900 relative overflow-hidden">
                {formData.image_url ? (
                  <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-800 gap-2">
                    <ImageIcon size={40} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Pa gen foto</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e1a] to-transparent" />
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase text-red-500 border border-white/10">
                  {CATEGORIES.find(c => c.id === formData.category)?.name || 'Kategori'}
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <h4 className="text-2xl font-black uppercase tracking-tighter truncate">
                    {formData.title || "Non Abònman an"}
                  </h4>
                  <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mt-1">
                    Sik: Chak {formData.billing_cycle}
                  </p>
                </div>

                <p className="text-zinc-400 text-sm leading-relaxed font-bold line-clamp-3 min-h-[4rem]">
                  {formData.description || "Deskripsyon sèvis ou an ap parèt isit la pou bay kliyan an detay sou sa l ap achte a."}
                </p>

                <div className="bg-black/40 rounded-2xl p-5 border border-white/5 flex justify-between items-center">
                  <span className="text-xs font-black uppercase text-zinc-500">Pri</span>
                  <span className="text-2xl font-black text-white">
                    {formData.price ? parseFloat(formData.price).toLocaleString() : '0'} <span className="text-sm text-red-600">HTG</span>
                  </span>
                </div>

                <button disabled className="w-full bg-white/5 text-zinc-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] border border-white/5 cursor-not-allowed">
                  Bouton Peman an
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}