"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Loader2, CreditCard, ShieldCheck, Calendar, 
  Info, CheckCircle2, Lock, AlertCircle, Store
} from 'lucide-react';

export default function SubscriptionCheckout() {
  const { id } = useParams();
  const router = useRouter();
  
  const [product, setProduct] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState('');

  const [cardInfo, setCardInfo] = useState({
    number: '',
    expiry: '',
    cvv: ''
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function getProductData() {
      // 1. Rale detay Pwodwi a
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (prodError || !prodData) {
        setError("Abònman sa a pa egziste.");
        setLoading(false);
        return;
      }

      // 2. Rale detay Machann nan
      const { data: profData } = await supabase
        .from('profiles')
        .select('business_name, full_name, avatar_url')
        .eq('id', prodData.owner_id)
        .single();

      setProduct(prodData);
      setMerchant(profData);
      setLoading(false);
    }

    if (id) getProductData();
  }, [id, supabase]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayLoading(true);
    // Isit la nou pral konekte ak Edge Function pou aktive abònman an
    // Pou kounye a nou simulation siksè a
    setTimeout(() => {
      setPayLoading(false);
      alert("Abònman aktive ak siksè!");
    }, 2000);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex flex-col items-center justify-center italic text-white font-black uppercase tracking-widest">
      <Loader2 className="animate-spin mb-4 text-red-600" size={48} />
      <span>Preparasyon Paj Peman...</span>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center p-6">
      <div className="bg-red-600/10 border border-red-600/20 p-10 rounded-[3rem] text-center max-w-md">
        <AlertCircle className="text-red-600 mx-auto mb-4" size={50} />
        <p className="text-white font-black uppercase text-sm">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 flex items-center justify-center italic font-medium">
      <div className="w-full max-w-[900px] grid md:grid-cols-2 bg-[#0d0e1a] border border-white/5 rounded-[4rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
        
        {/* PATI GOCH: REZIME PWODWI A */}
        <div className="p-10 md:p-14 bg-gradient-to-br from-red-600/10 to-transparent flex flex-col justify-between border-r border-white/5">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-xl">
                {merchant?.avatar_url ? (
                  <img src={merchant.avatar_url} className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <Store className="text-red-600" size={24} />
                )}
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Machann</p>
                <h3 className="text-lg font-black uppercase tracking-tighter">{merchant?.business_name || merchant?.full_name}</h3>
              </div>
            </div>

            <div className="space-y-4">
              {product.image_url && (
                <div className="h-48 w-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
                  <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <span className="text-[9px] bg-red-600/20 text-red-500 px-3 py-1 rounded-full font-black uppercase tracking-widest">{product.category}</span>
                <h1 className="text-3xl font-black uppercase tracking-tighter mt-3 leading-none">{product.title}</h1>
                <p className="text-zinc-500 text-xs font-bold mt-4 leading-relaxed">{product.description}</p>
              </div>
            </div>
          </div>

          <div className="pt-10 border-t border-white/5 space-y-2">
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em]">Plan Abònman</p>
            <div className="flex items-end gap-2">
               <span className="text-5xl font-black">{product.price.toLocaleString()}</span>
               <span className="text-red-600 font-black mb-1 italic uppercase tracking-tighter text-lg">HTG / {product.billing_cycle === 'month' ? 'Mwa' : product.billing_cycle}</span>
            </div>
          </div>
        </div>

        {/* PATI DWAT: FÒM PEMAN YO */}
        <div className="p-10 md:p-14 bg-black/40 relative">
          <div className="relative z-10 space-y-8">
            <div className="flex items-center gap-3 border-b border-white/5 pb-6">
               <ShieldCheck size={20} className="text-green-500" />
               <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest italic">Peman Sekirize (AES-256)</p>
            </div>

            <form onSubmit={handlePayment} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase mb-2 block ml-4 tracking-widest">Nimewo Kat H-Pay</label>
                  <input 
                    required
                    type="text" 
                    placeholder="0000 0000 0000 0000"
                    className="w-full bg-white/5 border border-white/10 rounded-[1.8rem] px-6 py-5 text-sm font-black text-white outline-none focus:border-red-600 transition-all placeholder:text-zinc-800"
                    value={cardInfo.number}
                    onChange={(e) => setCardInfo({...cardInfo, number: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-black uppercase mb-2 block ml-4 tracking-widest text-center">Ekspirasyon</label>
                    <input 
                      required
                      type="text" 
                      placeholder="MM/YY"
                      className="w-full bg-white/5 border border-white/10 rounded-[1.8rem] px-6 py-5 text-sm font-black text-white outline-none focus:border-red-600 transition-all text-center"
                      value={cardInfo.expiry}
                      onChange={(e) => setCardInfo({...cardInfo, expiry: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 font-black uppercase mb-2 block ml-4 tracking-widest text-center">CVV</label>
                    <input 
                      required
                      type="password" 
                      placeholder="•••"
                      className="w-full bg-white/5 border border-white/10 rounded-[1.8rem] px-6 py-5 text-sm font-black text-white outline-none focus:border-red-600 transition-all text-center"
                      value={cardInfo.cvv}
                      onChange={(e) => setCardInfo({...cardInfo, cvv: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-red-600/5 p-5 rounded-3xl border border-red-600/10 space-y-2">
                 <p className="text-[9px] text-zinc-400 font-bold uppercase leading-tight italic flex items-center gap-2">
                   <Info size={12} className="text-red-600" /> Atansyon: Ou pral debite otomatikman chak {product.billing_cycle === 'month' ? 'mwa' : product.billing_cycle}. Ou ka anile abònman sa a nenpòt lè nan dashboard ou.
                 </p>
              </div>

              <button
                disabled={payLoading}
                type="submit"
                className="w-full bg-white hover:bg-zinc-200 text-black py-6 rounded-[2.2rem] font-black uppercase text-[12px] tracking-tighter transition-all flex items-center justify-center gap-3 shadow-2xl disabled:opacity-50"
              >
                {payLoading ? <Loader2 className="animate-spin" size={20} /> : <Lock size={18} />}
                Kòmanse Abònman an
              </button>
            </form>

            <div className="flex items-center justify-center gap-6 opacity-30">
               <div className="h-[1px] bg-white/20 flex-1"></div>
               <CheckCircle2 size={16} />
               <div className="h-[1px] bg-white/20 flex-1"></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}