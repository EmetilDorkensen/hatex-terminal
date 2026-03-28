"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Loader2, CreditCard, ShieldCheck, AlertCircle, 
  ArrowLeft, CheckCircle2, Lock 
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

export default function CheckoutPaymentPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function getPaymentData() {
      if (!id) return;
      
      // 1. Rale detay abònman li vle achte a
      const { data: pData } = await supabase.from('products').select('*').eq('id', id).single();
      if (pData) setProduct(pData);

      // 2. Rale profil kliyan k ap achte a
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (prof) setProfile(prof);
      }
      setLoading(false);
    }
    getPaymentData();
  }, [id, supabase]);

  const handlePayment = async () => {
    // Sekirite: Si l pa konekte, voye l login
    if (!profile) {
      router.push('/login');
      return;
    }

    // Sekirite: Si l pa gen ase kòb
    if (profile.wallet_balance < product.price) {
      alert("Ou pa gen ase kòb sou balans HatexCard ou pou abònman sa a.");
      return;
    }

    setProcessing(true);
    try {
      // Rele fonksyon Supabase la pou fè tranzaksyon an an sekirite (Escrow)
      const { error } = await supabase.rpc('process_subscription_payment', {
        p_user_id: profile.id,
        p_product_id: product.id,
        p_amount: product.price,
        p_merchant_id: product.owner_id
      });

      if (error) throw error;
      
      // Peman an pase! Montre ekran siksè a
      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard/my-subscriptions'); // Voye l kote li ka wè sa l achte yo
      }, 3000);

    } catch (err: any) {
      alert("Erè nan peman an: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
      <Loader2 className="animate-spin text-red-600" size={50} />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen bg-[#06070d] text-white flex flex-col items-center justify-center p-6 text-center">
      <AlertCircle size={60} className="text-zinc-600 mb-6" />
      <h1 className="text-3xl font-black uppercase italic tracking-tighter">Sèvis pa disponib</h1>
      <button onClick={() => router.back()} className="mt-6 text-[10px] font-black uppercase tracking-widest text-red-600 hover:underline">
        Retounen nan boutik la
      </button>
    </div>
  );

  // EKRAN LÈ PEMAN AN PASE AK SIKSÈ
  if (success) return (
    <div className="min-h-screen bg-[#06070d] flex flex-col items-center justify-center text-white p-6 tracking-tighter italic text-center">
      <div className="bg-green-500/10 p-8 rounded-full mb-8">
        <CheckCircle2 size={100} className="text-green-500 animate-bounce" />
      </div>
      <h1 className="text-5xl font-black uppercase">Peman Reyisi!</h1>
      <p className="text-zinc-500 mt-4 font-black uppercase text-xs tracking-[0.3em]">
        Abònman <span className="text-white">{product.title}</span> an aktive.
      </p>
      <p className="text-zinc-600 mt-2 font-bold text-[10px] tracking-widest">W ap redirije nan dashboard ou...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-6 md:p-10 italic font-medium">
      <div className="max-w-xl mx-auto space-y-8 mt-4">
        
        <button onClick={() => router.back()} className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-colors tracking-widest">
          <ArrowLeft size={16} /> Retounen
        </button>

        <div className="space-y-2 text-center md:text-left">
          <h1 className="text-4xl font-black uppercase tracking-tighter">
            Konfime <span className="text-red-600">Peman</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
            Ou pral peye pou: {product.title}
          </p>
        </div>

        {/* KAT HATEXCARD KLIYAN AN */}
        <div className="space-y-3">
          <div className="flex justify-between items-center ml-4">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Kat Peman Ou</label>
            <span className="text-[9px] text-green-500 font-black uppercase flex items-center gap-1"><Lock size={10}/> Konekte</span>
          </div>
          
          <div className="bg-gradient-to-br from-red-600 to-red-900 p-8 md:p-10 rounded-[2.5rem] shadow-2xl shadow-red-600/20 relative overflow-hidden group">
            <div className="relative z-10 flex flex-col gap-10">
              <div className="flex justify-between items-start">
                <CreditCard size={35} className="text-white" />
                <span className="text-xs font-black italic tracking-widest opacity-50 uppercase">HatexCard</span>
              </div>
              
              <div>
                <p className="text-[10px] font-black uppercase opacity-60 mb-2">Balans Disponib</p>
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter">
                  {profile?.wallet_balance?.toLocaleString() || "0.00"} <span className="text-sm">HTG</span>
                </h2>
              </div>
              
              <div className="flex justify-between items-end">
                <p className="text-sm font-bold tracking-[0.4em]">**** **** **** 8273</p>
                <p className="text-[10px] font-black uppercase opacity-60 italic truncate max-w-[120px]">
                  {profile?.full_name || "Kliyan"}
                </p>
              </div>
            </div>
            <ShieldCheck className="absolute -right-16 -bottom-16 opacity-10 w-64 h-64 group-hover:scale-110 group-hover:rotate-12 transition-all duration-700" />
          </div>
        </div>

        {/* REZIME FAKTI A */}
        <div className="bg-[#0d0e1a] p-8 rounded-[2.5rem] border border-white/5 space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-6">
            <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Sik Abònman</span>
            <span className="text-xs font-black uppercase bg-white/5 px-3 py-1 rounded-lg">Chak {product.billing_cycle}</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-xs font-black uppercase text-zinc-400 italic">Total</span>
            <span className="text-3xl font-black text-white tracking-tighter">
              {product.price?.toLocaleString()} <span className="text-sm text-red-600">HTG</span>
            </span>
          </div>
        </div>

        {/* BOUTON POU PEYE A */}
        <div className="space-y-4">
          <button 
            onClick={handlePayment}
            disabled={processing}
            className="w-full bg-white text-black py-6 rounded-[2rem] font-black uppercase text-[12px] tracking-[0.3em] hover:bg-zinc-200 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/10 flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100"
          >
            {processing ? <Loader2 className="animate-spin text-black" size={24} /> : <><CreditCard size={20} /> KONFIME PEMAN AN</>}
          </button>

          <div className="flex items-center justify-center gap-2 text-[9px] text-zinc-600 font-black uppercase tracking-widest">
            <ShieldCheck size={14} className="text-green-600" />
            Lajan an ap bloke nan Escrow pou sekirite w
          </div>
        </div>

      </div>
    </div>
  );
}