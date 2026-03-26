"use client";

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Plus, Image as ImageIcon, Loader2, Link as LinkIcon, 
  CheckCircle2, AlertCircle, LayoutGrid, Clock, Tag, FileText,
  ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CreateSubscription() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [preview, setPreview] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    price: '',
    billing_cycle: 'month',
    image_file: null as File | null
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();
  }, [supabase]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData({ ...formData, image_file: file });
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      let image_url = '';

      if (formData.image_file) {
        const fileExt = formData.image_file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `products/${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, formData.image_file);

        if (uploadError) throw new Error('Erè nan upload foto a.');
        
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);
        
        image_url = publicUrl;
      }

      const { data: product, error: dbError } = await supabase
        .from('products')
        .insert([{
          owner_id: user.id,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          price: parseFloat(formData.price),
          billing_cycle: formData.billing_cycle,
          image_url: image_url
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      const link = `${window.location.origin}/subscribe/${product.id}`;
      setGeneratedLink(link);
      setMessage({ type: 'success', text: 'Abònman an kreye!' });

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-6 italic font-medium">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
        
        {/* PATI GOCH: FÒM NAN */}
        <div className="bg-[#0d0e1a] border border-white/5 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50"></div>
          
          <h1 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
            <Plus className="text-red-600" size={28} /> Kreye Abònman
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase mb-2 block ml-4 tracking-widest">Tit Abònman</label>
                <input 
                  required
                  type="text" 
                  placeholder="Egz: Netflix Premium"
                  className="w-full bg-black/40 border border-white/10 rounded-[1.5rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-red-600 transition-all shadow-inner"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase mb-2 block ml-4 tracking-widest">Kategori Custom</label>
                <input 
                  required
                  type="text" 
                  placeholder="Egz: Streaming, IPTV..."
                  className="w-full bg-black/40 border border-white/10 rounded-[1.5rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-red-600 transition-all shadow-inner"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase mb-2 block ml-4 tracking-widest text-center">Pri (HTG)</label>
                <input 
                  required
                  type="number" 
                  className="w-full bg-black/40 border border-white/10 rounded-[1.5rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-red-600 transition-all text-center"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase mb-2 block ml-4 tracking-widest text-center">Rekirans</label>
                <select 
                  className="w-full bg-black/40 border border-white/10 rounded-[1.5rem] px-6 py-4 text-[11px] font-black text-white outline-none focus:border-red-600 transition-all cursor-pointer uppercase"
                  value={formData.billing_cycle}
                  onChange={(e) => setFormData({...formData, billing_cycle: e.target.value})}
                >
                  <option value="hour">Chak Lè</option>
                  <option value="day">Chak Jou</option>
                  <option value="week">Chak Semèn</option>
                  <option value="month">Chak Mwa</option>
                </select>
              </div>
            </div>

            <div className="relative">
               <label className="text-[10px] text-zinc-500 font-black uppercase mb-2 block ml-4 tracking-widest">Foto Pwodwi</label>
               <label className="flex flex-col items-center justify-center w-full h-36 bg-black/40 border-2 border-dashed border-white/5 rounded-[2rem] cursor-pointer hover:border-red-600/30 transition-all overflow-hidden">
                  {preview ? (
                    <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center italic">
                      <ImageIcon className="text-zinc-700 mb-2" size={30} />
                      <p className="text-[9px] text-zinc-500 font-black uppercase">Klike pou chwazi foto</p>
                    </div>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
               </label>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-red-900/20 active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
              Mete sou mache a
            </button>
          </form>
        </div>

        {/* PATI DWAT: REZILTA AK REDIREKSYON */}
        <div className="flex flex-col gap-6">
          <div className="bg-white/[0.02] border border-white/5 rounded-[3.5rem] p-10 flex flex-col items-center justify-center text-center relative overflow-hidden h-full min-h-[400px]">
            {generatedLink ? (
              <div className="space-y-8 animate-in zoom-in duration-500">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
                  <CheckCircle2 className="text-green-500" size={40} />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Siksè!</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Abònman an aktif kounye a</p>
                </div>

                <div className="w-full space-y-4">
                  <div className="bg-black/80 border border-white/5 p-4 rounded-2xl flex items-center justify-between group">
                    <code className="text-[10px] text-red-600 font-black truncate italic mr-4">{generatedLink}</code>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedLink);
                        alert("Lyen kopye!");
                      }}
                      className="p-2 bg-white/5 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                    >
                      <LinkIcon size={16} />
                    </button>
                  </div>

                  {/* BOUTON REDIREKSYON POU MACHANN NAN */}
                  <button
                    onClick={() => router.push('/dashboard/subscriptions')}
                    className="w-full bg-white text-black py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all shadow-xl group"
                  >
                    <LayoutGrid size={18} />
                    Dashboard Abònman
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 opacity-30">
                <Tag size={60} className="mx-auto text-zinc-700" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Rezime ap parèt la a</p>
              </div>
            )}
          </div>
          
          <div className="bg-white/[0.01] border border-white/5 rounded-[2.5rem] p-6 flex items-center gap-4">
             <div className="p-3 bg-red-600/10 rounded-2xl">
                <Clock className="text-red-600" size={20} />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase leading-none mb-1">Peman Rekiran</p>
                <p className="text-[9px] text-zinc-600 font-bold uppercase italic">Sistèm nan ap jere koleksyon an pou ou.</p>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}