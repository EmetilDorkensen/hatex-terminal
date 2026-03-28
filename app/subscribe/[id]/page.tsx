"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Loader2, CreditCard, ShieldCheck, AlertCircle, 
  ArrowLeft, CheckCircle2, Lock, Smartphone, 
  ShieldAlert, Fingerprint, Receipt, Info, 
  ChevronRight, Wallet, History
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

export default function SubscribePage() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();

  // STATES POU DONE YO
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  
  // STATES POU SEKIRITE
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txId, setTxId] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function getCheckoutData() {
      if (!id || id === 'undefined') return;

      try {
        // 1. Rale enfòmasyon pwodwi a
        const { data: p, error: pErr } = await supabase
          .from('products')
          .select('*, profiles(*)')
          .eq('id', id)
          .single();

        if (pErr) throw pErr;
        setProduct(p);
        setMerchant(p.profiles);

        // 2. Rale pwofil moun k ap peye a
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: pr, error: prErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (prErr) throw prErr;
          setProfile(pr);
        } else {
          router.push('/login?next=/subscribe/' + id);
        }
      } catch (err: any) {
        console.error("Erè Checkout:", err.message);
        setError("Sèvis sa a pa disponib pou kounye a.");
      } finally {
        setLoading(false);
      }
    }
    getCheckoutData();
  }, [id, supabase, router]);

  const handleProcessPayment = async () => {
    setError(null);

    // 1. Verifikasyon debaz
    if (pin.length < 4) {
      setError("Ou dwe antre yon kòd PIN valid.");
      return;
    }

    if (!profile || profile.wallet_balance < product.price) {
      setError("Balans ou pa ase pou tranzaksyon sa a.");
      return;
    }

    setProcessing(true);

    try {
      // Isit la nou ta nòmalman rele yon RPC nan Supabase pou nou fè tranzaksyon an (Atomicity)
      // Pou egzanp sa a, n ap simule yon tranzaksyon sekirize
      
      const fakeTxId = 'HPY-' + Math.random().toString(36).substring(2, 11).toUpperCase();
      
      // Simulate API Delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Si tout bagay bon:
      setTxId(fakeTxId);
      setSuccess(true);
    } catch (err: any) {
      setError("Tranzaksyon an echwe: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-red-600 mb-4" size={60} />
      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600">Secure Environment</p>
    </div>
  );

  if (success) return (
    <div className="min-h-screen bg-[#06070d] text-white flex flex-col items-center justify-center p-6 italic text-center">
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-green-500 blur-[80px] opacity-20 rounded-full" />
        <div className="relative w-32 h-32 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500/30">
          <CheckCircle2 size={64} className="text-green-500" />
        </div>
      </div>
      
      <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none mb-6">Peman <span className="text-green-500">Konfime</span></h1>
      <p className="text-zinc-500 font-bold max-w-md mx-auto mb-10 leading-relaxed">
        Abònman ou pou <span className="text-white">{product.title}</span> aktive. Ou ka jere li nan dashboard ou.
      </p>

      <div className="bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] p-8 w-full max-w-sm space-y-4 mb-12">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
          <span>Tranzaksyon ID</span>
          <span className="text-white">{txId}</span>
        </div>
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
          <span>Metòd</span>
          <span className="text-white font-bold italic">Hatex Wallet</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <button onClick={() => router.push('/dashboard/subscriptions')} className="flex-1 bg-white text-black py-6 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:bg-green-500 hover:text-white transition-all">Wè Abònman</button>
        <button onClick={() => router.push('/dashboard')} className="flex-1 bg-[#0d0e1a] text-white py-6 rounded-3xl font-black uppercase text-[10px] tracking-widest border border-white/5 hover:bg-white/10 transition-all">Dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 md:p-12 italic font-medium selection:bg-red-600">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16">
        
        {/* LÈF (SUMÈ PWODWI) */}
        <div className="lg:col-span-7 space-y-12">
          <button onClick={() => router.back()} className="flex items-center gap-3 text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-all tracking-[0.3em]">
            <ArrowLeft size={18} /> Anile Tranzaksyon
          </button>

          <div className="space-y-4">
             <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-[0.8]">Finalize <span className="text-red-600">Peman</span></h1>
             <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600 italic">H-Pay Escrow Protected</p>
          </div>

          <div className="bg-[#0d0e1a] border border-white/5 rounded-[4rem] overflow-hidden shadow-2xl">
            <div className="p-10 md:p-14 space-y-10">
               <div className="flex items-start justify-between gap-6">
                  <div className="space-y-2 flex-1">
                    <span className="text-[10px] text-red-500 font-black uppercase tracking-[0.3em]">{product.category}</span>
                    <h2 className="text-4xl font-black uppercase tracking-tighter">{product.title}</h2>
                    <p className="text-zinc-500 text-sm font-bold leading-relaxed line-clamp-2 italic">{product.description}</p>
                  </div>
                  <div className="w-24 h-24 rounded-3xl bg-zinc-900 border border-white/5 overflow-hidden flex-shrink-0">
                    {product.image_url ? <img src={product.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-800"><Receipt size={30} /></div>}
                  </div>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-10 border-t border-white/5">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Sik Peman</p>
                    <p className="text-sm font-black uppercase italic">Chak {product.billing_cycle === 'month' ? 'Mwa' : product.billing_cycle}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Vandè</p>
                    <p className="text-sm font-black uppercase italic truncate">{merchant?.full_name}</p>
                  </div>
                  <div className="space-y-1 col-span-2 md:col-span-1">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-red-500">Total Pou Peye</p>
                    <p className="text-3xl font-black italic">{product.price.toLocaleString()} <span className="text-xs text-red-600">HTG</span></p>
                  </div>
               </div>

               <div className="bg-red-600/5 border border-red-600/20 p-6 rounded-3xl flex gap-4 items-start">
                  <ShieldAlert className="text-red-600 flex-shrink-0" size={20} />
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-bold italic">
                    Lajan sa ap rete nan sistèm Escrow nou an jiskaske sèvis la aktive. Si ou pa jwenn sèvis la, ou ka fè yon reklamasyon nan 24h.
                  </p>
               </div>
            </div>
          </div>
        </div>

        {/* DWAT (METÒD PEMAN AK VERIFIKASYON) */}
        <div className="lg:col-span-5 space-y-10">
           
           {/* WALLET CARD */}
           <div className="bg-gradient-to-br from-zinc-900 to-black p-10 rounded-[3.5rem] border border-white/10 shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-red-600/10 blur-[100px] rounded-full group-hover:bg-red-600/20 transition-all duration-1000" />
              
              <div className="relative z-10 space-y-12">
                <div className="flex justify-between items-start">
                  <div className="w-14 h-9 bg-white/10 rounded-lg border border-white/10 flex items-center justify-center font-black text-[10px] italic text-zinc-400">H-PAY</div>
                  <Smartphone size={32} className="text-red-600" />
                </div>

                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Balans HatexWallet</p>
                  <h2 className="text-5xl font-black tracking-tighter italic">
                    {profile?.wallet_balance?.toLocaleString() || "0.00"} <span className="text-sm text-red-600">HTG</span>
                  </h2>
                </div>

                <div className="flex justify-between items-end border-t border-white/5 pt-8">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest italic">Detantè</p>
                    <p className="text-xs font-black uppercase tracking-tighter">{profile?.full_name || "Merchant User"}</p>
                  </div>
                  <div className="text-right">
                    <Fingerprint size={24} className="text-red-600 opacity-50" />
                  </div>
                </div>
              </div>
           </div>

           {/* VERIFIKASYON PIN */}
           <div className="bg-[#0d0e1a] border border-white/5 rounded-[3.5rem] p-10 space-y-8">
              <div className="space-y-2 text-center">
                <h3 className="text-xl font-black uppercase tracking-widest italic">Verifikasyon <span className="text-red-600">PIN</span></h3>
                <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Antre kòd sekirite 4 chif ou a</p>
              </div>

              <div className="flex justify-center">
                <input 
                  type="password" 
                  maxLength={4}
                  placeholder="****"
                  className="w-48 bg-black border-2 border-white/5 rounded-2xl p-6 text-center text-4xl font-black tracking-[0.5em] outline-none focus:border-red-600 transition-all text-red-600"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              {error && (
                <div className="bg-red-600/10 border border-red-600/20 p-4 rounded-2xl flex items-center gap-3 text-red-500">
                  <AlertCircle size={18} />
                  <span className="text-[10px] font-black uppercase italic tracking-widest">{error}</span>
                </div>
              )}

              <button 
                onClick={handleProcessPayment}
                disabled={processing || pin.length < 4}
                className="w-full bg-white text-black py-8 rounded-[2.5rem] font-black uppercase text-[14px] tracking-[0.5em] hover:bg-red-600 hover:text-white hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-4 disabled:opacity-30"
              >
                {processing ? <Loader2 className="animate-spin" size={28} /> : <><Lock size={24} /> KONFIME PEMAN</>}
              </button>

              <div className="flex flex-col items-center gap-4 pt-4">
                 <div className="flex items-center gap-2 text-[8px] font-black text-zinc-700 uppercase tracking-widest">
                   <ShieldCheck size={12} className="text-green-600" /> PCI DSS COMPLIANT
                 </div>
                 <div className="flex items-center gap-2 text-[8px] font-black text-zinc-700 uppercase tracking-widest">
                   <Lock size={12} className="text-green-600" /> END-TO-END ENCRYPTION
                 </div>
              </div>
           </div>

           {/* HELP LINK */}
           <div className="text-center">
             <button className="text-[10px] font-black uppercase text-zinc-600 hover:text-white transition-all tracking-widest italic border-b border-zinc-800 pb-1">Ou bliye PIN ou? Kontakte Sipò</button>
           </div>
        </div>

      </div>
    </div>
  );
}