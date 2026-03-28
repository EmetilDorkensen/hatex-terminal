"use client";

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { CATEGORY_GROUPS, ALL_CATEGORIES } from '@/constants/categories';
import { LayoutGrid, Tv, ShieldCheck, Info, Loader2, Plus, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CreateProduct() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const isStreaming = CATEGORY_GROUPS.STREAMING.includes(category);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const title = formData.get('title');
    const price = formData.get('price');
    const whatsapp = formData.get('whatsapp');
    
    // Enfòmasyon Sekrè
    const email = formData.get('stream_email');
    const password = formData.get('stream_password');
    const pin = formData.get('stream_pin');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Konekte anvan");

      // Validasyon pou Streaming
      if (isStreaming && (!email || !password)) {
        throw new Error("Pou kategori streaming, ou dwe bay imèl ak modpas kont lan!");
      }

      const { error } = await supabase.from('products').insert([{
        title,
        price: parseFloat(price as string),
        category,
        merchant_whatsapp: whatsapp,
        owner_id: user.id,
        streaming_credentials: isStreaming ? { email, password, pin } : null,
        description: formData.get('description')
      }]);

      if (error) throw error;
      router.push('/dashboard/products');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20">
            <Plus size={28} />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Kreye yon Nouvo Of</h1>
        </div>

        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-8">
          
          {/* KOLEKSYON ENFÒMASYON JENERAL */}
          <div className="space-y-6">
            <div className="bg-[#0d0e1a] border border-white/5 p-8 rounded-[2.5rem] space-y-4">
              <label className="block">
                <span className="text-[10px] font-black uppercase text-zinc-500 ml-2">Non Pwodwi a</span>
                <input name="title" required className="w-full bg-black border border-white/10 p-4 rounded-2xl mt-1 focus:border-red-600 outline-none transition-all" placeholder="ex: Netflix 1 Mwa Profile" />
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase text-zinc-500 ml-2">Kategori (Chwazi nan lis la)</span>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  required 
                  className="w-full bg-black border border-white/10 p-4 rounded-2xl mt-1 focus:border-red-600 outline-none"
                >
                  <option value="">Chwazi yon kategori</option>
                  {Object.entries(CATEGORY_GROUPS).map(([group, list]) => (
                    <optgroup key={group} label={group} className="bg-zinc-900 text-red-500">
                      {list.map(cat => <option key={cat} value={cat} className="text-white">{cat}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-zinc-500 ml-2">Pris (HTG)</span>
                  <input name="price" type="number" required className="w-full bg-black border border-white/10 p-4 rounded-2xl mt-1 focus:border-red-600 outline-none" placeholder="500" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-zinc-500 ml-2">WhatsApp Kontak</span>
                  <input name="whatsapp" required className="w-full bg-black border border-white/10 p-4 rounded-2xl mt-1 focus:border-red-600 outline-none" placeholder="509..." />
                </label>
              </div>
            </div>
          </div>

          {/* KOLEKSYON ENFÒMASYON SEKIRIZE (STREAMING) */}
          <div className="space-y-6">
            <div className={`transition-all duration-500 ${isStreaming ? 'opacity-100 translate-y-0' : 'opacity-30 pointer-events-none scale-95'}`}>
              <div className="bg-red-600/5 border border-red-600/20 p-8 rounded-[2.5rem] space-y-4 relative overflow-hidden">
                {isStreaming && <div className="absolute top-4 right-4 animate-pulse text-red-500"><Tv size={20}/></div>}
                
                <h3 className="text-sm font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                  <ShieldCheck size={18} /> Detay Kont Streaming
                </h3>
                <p className="text-[10px] text-zinc-500 font-bold">Kliyan an ap resevwa enfòmasyon sa yo otomatikman apre l fin peye.</p>

                <label className="block">
                  <span className="text-[10px] font-black uppercase text-zinc-400 ml-2">Email / Username</span>
                  <input name="stream_email" required={isStreaming} className="w-full bg-black border border-white/10 p-4 rounded-2xl mt-1 focus:border-red-600 outline-none" />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase text-zinc-400 ml-2">Modpas</span>
                  <input name="stream_password" type="text" required={isStreaming} className="w-full bg-black border border-white/10 p-4 rounded-2xl mt-1 focus:border-red-600 outline-none" />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase text-zinc-400 ml-2">Kòd PIN (Opsyonèl)</span>
                  <input name="stream_pin" className="w-full bg-black border border-white/10 p-4 rounded-2xl mt-1 focus:border-red-600 outline-none" placeholder="ex: 1234" />
                </label>
              </div>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-white text-black py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Pibliye Pwodwi a Kounye a"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}