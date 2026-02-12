"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useMemo, Suspense, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ShieldCheck, Lock, ShoppingBag, AlertCircle, 
  CreditCard, CheckCircle2, Globe, Server, UserCheck
} from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [amount, setAmount] = useState<number>(0);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('Hatex Secure Pay');
  const [orderId, setOrderId] = useState('PENDING');
  const [checkoutType, setCheckoutType] = useState<'invoice' | 'terminal' | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [form, setForm] = useState({ card: '', expiry: '', cvv: '' });

  const sdkData = useMemo(() => ({
    platform: searchParams.get('platform') || 'Hatex Gateway',
    customer_name: searchParams.get('customer_name') || 'Kliyan Hatex',
    customer_phone: searchParams.get('customer_phone') || 'N/A',
    customer_address: searchParams.get('customer_address') || 'N/A',
    customer_email: searchParams.get('customer_email') || '',
    product_name: searchParams.get('product_name') || '',
    product_image: searchParams.get('product_image'),
    quantity: parseInt(searchParams.get('quantity') || '1')
  }), [searchParams]);

  useEffect(() => {
    const initCheckout = async () => {
      const invId = searchParams.get('invoice_id');
      const termId = searchParams.get('terminal');

      if (invId) {
        setCheckoutType('invoice');
        const { data: inv } = await supabase
          .from('invoices')
          .select('*, profiles:owner_id(business_name, email)')
          .eq('id', invId)
          .single();
        
        if (inv) {
          setAmount(Number(inv.amount));
          setReceiverId(inv.owner_id);
          setOrderId(`INV-${inv.id.slice(0, 8).toUpperCase()}`);
          setBusinessName(inv.profiles?.business_name || 'Merchant Hatex');
        }
      } else if (termId) {
        setCheckoutType('terminal');
        setReceiverId(termId);
        setAmount(parseFloat(searchParams.get('amount') || '0'));
        setOrderId(searchParams.get('order_id') || `TX-${Date.now().toString().slice(-6)}`);
        
        const { data: prof } = await supabase.from('profiles').select('business_name').eq('id', termId).single();
        if (prof) setBusinessName(prof.business_name);
      }
    };
    initCheckout();
  }, [searchParams, supabase]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverId || amount <= 0) return setStatus({ type: 'error', msg: 'Tranzaksyon envalid.' });
    
    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const { data, error: rpcError } = await supabase.rpc('process_secure_payment', {
        p_terminal_id: receiverId,
        p_card_number: form.card.replace(/\s/g, ''),
        p_card_cvv: form.cvv,
        p_card_expiry: form.expiry,
        p_amount: amount,
        p_order_id: orderId,
        p_customer_name: sdkData.customer_name,
        p_platform: sdkData.platform
      });

      if (rpcError) throw rpcError;

      if (data && data.success) {
        if (checkoutType === 'invoice') {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', searchParams.get('invoice_id'));
        }

        // WEBHOOK EMAIL
        const { data: merchantProf } = await supabase.from('profiles').select('email').eq('id', receiverId).single();
        const emailPayload = {
          transaction_id: data.transaction_id,
          business_name: businessName,
          amount: amount,
          sdk: { ...sdkData, merchant_email: merchantProf?.email || "" }
        };

        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resend-email`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify(emailPayload)
        }).catch(err => console.error("Email error:", err));

        router.push(`/checkout/success?amount=${amount}&id=${data.transaction_id}&order_id=${orderId}`);
      } else {
        throw new Error(data?.message || "Erreur lors du traitement.");
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070d] text-white flex items-center justify-center p-4 md:p-10 font-sans italic selection:bg-red-600/30">
      <div className="w-full max-w-[900px] grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden rounded-[4rem] border border-white/5 shadow-2xl bg-[#0d0e1a]">
        
        {/* SIDEBAR GOCH: RECAPITULATIF (Rann paj la pi long) */}
        <div className="p-10 lg:p-16 bg-gradient-to-b from-white/[0.03] to-transparent border-r border-white/5">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20">
              <ShoppingBag size={20} className="text-white" />
            </div>
            <span className="font-black uppercase tracking-widest text-[12px]">Récapitulatif</span>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-black tracking-tighter mb-2">{businessName}</h2>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Facture Officielle HatexCard</p>
            </div>

            {/* Done Pwodwi */}
            <div className="py-8 border-y border-white/5 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-black rounded-[2rem] border border-white/10 flex items-center justify-center overflow-hidden">
                   {sdkData.product_image ? <img src={sdkData.product_image} className="w-full h-full object-cover" /> : <Server className="text-zinc-800" size={32} />}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-black uppercase tracking-tight leading-none mb-2">{sdkData.product_name || 'Service Digital'}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Quantité: {sdkData.quantity}</p>
                </div>
              </div>
            </div>

            {/* Done Sekirite (Sa rann li pi long) */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-green-500/60">
                <CheckCircle2 size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">Marchand Vérifié (KYC)</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-500">
                <Globe size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">Réseau Hatex Global Secure</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-500">
                <UserCheck size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">ID Client: {sdkData.customer_name.slice(0,10)}...</span>
              </div>
            </div>

            <div className="pt-10">
              <p className="text-[10px] text-zinc-500 uppercase font-black mb-4 tracking-widest">Total à régler</p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black tracking-tighter italic">{amount.toLocaleString()}</span>
                <span className="text-xl font-black text-red-600">HTG</span>
              </div>
            </div>
          </div>
        </div>

        {/* BÒ DWAT: FÒMILÈ PEMAN */}
        <div className="p-10 lg:p-16 bg-[#0d0e1a]">
          <div className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-red-600" />
              <span className="text-[10px] font-black uppercase tracking-widest">Paiement Sécurisé</span>
            </div>
            <div className="flex gap-2">
              <div className="w-6 h-4 bg-zinc-800 rounded-sm"></div>
              <div className="w-6 h-4 bg-zinc-700 rounded-sm"></div>
            </div>
          </div>

          <form onSubmit={handlePayment} className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] text-zinc-500 font-black uppercase ml-2 tracking-widest">Numéro de Carte Hatex</label>
              <div className="relative">
                <input 
                  required 
                  placeholder="0000 0000 0000 0000" 
                  className="w-full bg-black border border-white/10 p-6 rounded-[2rem] text-[16px] font-mono outline-none focus:border-red-600 transition-all placeholder:text-zinc-800" 
                  onChange={e => setForm({...form, card: e.target.value})} 
                />
                <CreditCard className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-800" size={20} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] text-zinc-500 font-black uppercase ml-2">Expiration</label>
                <input 
                  required 
                  placeholder="MM/YY" 
                  maxLength={5}
                  value={form.expiry}
                  className="w-full bg-black border border-white/10 p-6 rounded-[2rem] text-[14px] outline-none text-white italic transition-all focus:border-red-600 text-center" 
                  onChange={e => {
                    let v = e.target.value.replace(/\D/g, '');
                    if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2,4);
                    setForm({...form, expiry: v});
                  }} 
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] text-zinc-500 font-black uppercase ml-2 text-center block">Code CVV</label>
                <input 
                  required 
                  type="password" 
                  maxLength={3} 
                  placeholder="***" 
                  className="w-full bg-black border border-white/10 p-6 rounded-[2rem] text-[14px] outline-none text-center text-white font-mono focus:border-red-600 transition-all" 
                  onChange={e => setForm({...form, cvv: e.target.value})} 
                />
              </div>
            </div>

            <div className="pt-6">
              <button 
                disabled={loading || amount <= 0} 
                className="w-full bg-red-600 hover:bg-red-700 py-7 rounded-[2.5rem] font-black uppercase text-[13px] tracking-widest shadow-2xl shadow-red-600/20 active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    AUTHENTIFICATION...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    CONFIRMER LE PAIEMENT
                  </>
                )}
              </button>
            </div>
          </form>

          {status.msg && (
            <div className="mt-8 p-6 bg-red-600/10 border border-red-600/20 rounded-[2rem] flex items-start gap-4 animate-in slide-in-from-bottom-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-500 text-[11px] font-black uppercase leading-tight italic">{status.msg}</p>
            </div>
          )}

          <div className="mt-12 text-center">
            <p className="text-[8px] text-zinc-700 font-black uppercase tracking-[0.4em]">Hatex Card Payment Gateway v4.1 Secure</p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="bg-black min-h-screen"></div>}>
      <CheckoutContent />
    </Suspense>
  );
}