"use client";

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ShieldCheck, Lock, AlertCircle, Info, Loader2, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CheckoutPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: prod, error: pErr } = await supabase
          .from('products')
          .select('*, profiles(*)')
          .eq('id', params.id)
          .single();

        if (pErr || !prod) throw new Error("Pwodwi sa a pa egziste.");
        
        setProduct(prod);
        setMerchant(prod.profiles);
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };
    loadData();
  }, [params.id, supabase]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ou dwe konekte.");

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

      if (!profile || (profile.kyc_status !== 'verified' && profile.kyc_status !== 'approved')) {
        throw new Error("Ou dwe verifye KYC ou anvan ou fè abònman.");
      }

      if (profile.wallet_balance < product.price) throw new Error("Kòb ou pa ase. Recharge bous ou.");

      // Kalkile lè pou kòb la lage bay machann nan (1h 15 minit)
      const releaseTime = new Date();
      releaseTime.setMinutes(releaseTime.getMinutes() + 75);

      // KREYE ABÒNMAN AN EPI METE KÒD STREAMING YO SI LI GENYEN L
      const { error: subError } = await supabase.from('subscriptions').insert([{
        product_id: product.id,
        client_id: user.id,
        merchant_id: product.owner_id,
        status: 'pending_escrow',
        amount: product.price,
        provided_credentials: product.streaming_credentials || null,
        escrow_release_at: releaseTime.toISOString()
      }]);

      if (subError) throw subError;

      // RELE FONKSYON POU BLOKE KÒB LA
      await supabase.rpc('process_secure_payment', {
        amount_val: product.price,
        client_id_val: user.id,
        product_id_val: product.id,
        merchant_id_val: product.owner_id
      });

      router.push(`/subscribe/${params.id}/success`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPayLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#06070d] flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={48} /></div>;

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 flex items-center justify-center font-medium">
      <div className="w-full max-w-[1000px] grid md:grid-cols-2 bg-[#0d0e1a] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
        
        {/* PATI GOCH: ENFÒMASYON PWODWI AK MACHANN */}
        <div className="p-8 md:p-12 bg-gradient-to-br from-zinc-900 to-black border-r border-white/5 relative">
          
          <div className="space-y-6">
             <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center">
                  {merchant.avatar_url ? <img src={merchant.avatar_url} className="w-full h-full rounded-full" /> : <ShieldCheck className="text-red-500" />}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{merchant.full_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone size={14} className="text-green-500" />
                    <span className="text-sm text-zinc-400">{product.merchant_whatsapp || merchant.phone || "Pa gen nimewo disponib"}</span>
                  </div>
                </div>
             </div>

             <div className="bg-red-600/10 border border-red-500/20 rounded-2xl p-6">
                <h1 className="text-2xl font-black uppercase mb-2">{product.title}</h1>
                <span className="text-xs bg-red-600 text-white px-2 py-1 rounded font-bold uppercase">{product.category}</span>
                
                <div className="mt-6 flex items-end gap-2">
                  <span className="text-5xl font-black">{Number(product.price).toLocaleString()}</span>
                  <span className="text-red-500 font-bold mb-1 text-lg">HTG</span>
                </div>
             </div>
          </div>

        </div>

        {/* PATI DWAT: AVÈTISMAN AK PEMAN */}
        <div className="p-8 md:p-12 bg-black relative flex flex-col justify-center">
          <form onSubmit={handlePayment} className="space-y-6">
            
            <div className="bg-orange-500/10 border border-orange-500/20 p-5 rounded-3xl space-y-3">
               <div className="flex items-center gap-2 text-orange-500 font-black uppercase text-sm">
                 <AlertCircle size={20} />
                 Sistèm Pwoteksyon Hatex (Escrow)
               </div>
               <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                 Lè ou peye, kòb la ap kenbe nan sistèm nan pou <span className="text-white">1 èdtan ak 15 minit</span>. Enfòmasyon abònman an ap parèt otomatikman sou pwochen paj la.
               </p>
               <p className="text-xs text-red-400 font-black mt-2">
                 SI OU PA JWENN KONT LA, OU GEN EGZAKTEMAN 1H POU KONTAKTE SIPÒ HATEX LA SOU WHATSAPP POU YO RANBOUSE W. APRE 1H, KÒB LA AP ALE JWENN MACHANN NAN EPI OU PÈDI REKOU OU!
               </p>
            </div>

            <button
              disabled={payLoading}
              type="submit"
              className="w-full bg-white hover:bg-zinc-200 text-black py-5 rounded-full font-black uppercase text-sm transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {payLoading ? <Loader2 className="animate-spin" size={20} /> : <Lock size={18} />}
              Peye ak Bous H-Pay mwen ({product.price} HTG)
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}