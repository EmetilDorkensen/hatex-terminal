"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Loader2, 
  CreditCard, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Info 
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

export default function SubscribePage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function getData() {
      try {
        const { data: pData } = await supabase.from('products').select('*').eq('id', id).single();
        setProduct(pData);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          setProfile(prof);
        }
      } catch (err) {
        console.error("Erè chajman:", err);
      } finally {
        setLoading(false);
      }
    }
    getData();
  }, [id, supabase]);

  const handlePayment = async () => {
    if (!profile) return router.push('/login');
    if (profile.wallet_balance < product.price) {
      alert("Balans HatexCard ou pa sifi!");
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase.rpc('process_subscription_payment', {
        p_user_id: profile.id,
        p_product_id: product.id,
        p_amount: product.price,
        p_merchant_id: product.owner_id
      });

      if (error) throw error;
      
      alert("Peman reyisi! Sèvis ou a ap aktive imedyatman.");
      router.push('/dashboard/my-subscriptions');
    } catch (err: any) {
      alert("Erè: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
      <Loader2 className="animate-spin text-red-600" size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-6 md:p-10 italic font-medium">
      <div className="max-w-xl mx-auto space-y-8">
        
        {/* ENFÒMASYON PWODWI */}
        <div className="bg-[#0d0e1a] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
          <div className="h-56 bg-zinc-900 relative">
            {product?.image_url ? (
              <img src={product.image_url} alt={product.title} className="w-full h-full object-cover opacity-60" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-800">No Image</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e1a] to-transparent" />
            <div className="absolute bottom-6 left-8">
              <span className="text-[10px] text-red-600 font-black uppercase tracking-[0.3em]">{product?.category}</span>
              <h1 className="text-4xl font-black uppercase tracking-tighter mt-1">{product?.title}</h1>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <p className="text-zinc-400 text-sm leading-relaxed font-bold">
              {product?.description || "Pa gen deskripsyon pou sèvis sa a."}
            </p>

            {/* KAT HATEXCARD KLIYAN */}
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Mwayen Peman</p>
              <div className="bg-gradient-to-br from-red-600 to-red-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <div className="relative z-10 flex flex-col h-full justify-between gap-10">
                  <div className="flex justify-between items-start">
                    <CreditCard size={32} />
                    <span className="text-xs font-black italic tracking-widest opacity-50 uppercase">HatexCard</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-60 mb-1">Balans Disponib</p>
                    <h2 className="text-3xl font-black tracking-tighter">
                      {profile?.wallet_balance?.toLocaleString() || "0.00"} <span className="text-sm">HTG</span>
                    </h2>
                  </div>
                  <div className="flex justify-between items-end">
                    <p className="text-sm font-bold tracking-[0.3em]">**** **** **** 8273</p>
                    <p className="text-[10px] font-black uppercase opacity-40 italic">Kalibous Emetil</p>
                  </div>
                </div>
                <ShieldCheck className="absolute -right-12 -bottom-12 opacity-10 w-48 h-48 group-hover:scale-110 transition-transform duration-700" />
              </div>
            </div>

            {/* DETAY PRI */}
            <div className="bg-black/40 border border-white/5 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Info size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Sik Faktirasyon</span>
                </div>
                <span className="text-xs font-black uppercase">Chak {product?.billing_cycle}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase text-zinc-300 italic">Total pou w peye</span>
                <span className="text-2xl font-black text-red-600 tracking-tighter">{product?.price?.toLocaleString()} HTG</span>
              </div>
            </div>

            {/* BOUTON AK SEKIRITE */}
            <div className="space-y-4">
              <button 
                onClick={handlePayment}
                disabled={processing}
                className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-[12px] tracking-[0.3em] hover:bg-zinc-200 active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {processing ? <Loader2 className="animate-spin" /> : <><CreditCard size={20} /> KONFIME PEMAN</>}
              </button>

              <div className="flex items-center justify-center gap-2 text-[9px] text-zinc-600 font-black uppercase tracking-widest bg-white/5 py-3 rounded-xl border border-white/5">
                <ShieldCheck size={14} className="text-green-600" />
                Sekirize pa H-Pay Shield • Lajan an pwoteje nan Escrow
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}