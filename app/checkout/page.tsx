"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useMemo, Suspense, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ShieldCheck, Lock, ShoppingBag, AlertCircle, 
  CreditCard, CheckCircle2, Globe, Server, UserCheck,
  MapPin, Phone, Mail, Package, Truck, ShieldAlert
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

  // Done SDK / Livrezon
  const sdkData = useMemo(() => ({
    platform: searchParams.get('platform') || 'Hatex Gateway',
    customer_name: searchParams.get('customer_name') || 'Kliyan Hatex',
    customer_phone: searchParams.get('customer_phone') || 'N/A',
    customer_address: searchParams.get('customer_address') || 'N/A',
    customer_email: searchParams.get('customer_email') || 'N/A',
    product_name: searchParams.get('product_name') || 'Service Digital',
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
          .select('*, profiles:owner_id(business_name, kyc_status)')
          .eq('id', invId)
          .single();
        
        if (inv) {
          if (inv.status === 'paid') {
            setStatus({ type: 'error', msg: 'Invoice sa a te deja peye.' });
          }
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
      <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-[4rem] border border-white/5 shadow-2xl bg-[#0d0e1a]">
        
        {/* SIDEBAR GOCH: RECAPITULATIF ETAIYE */}
        <div className="p-10 lg:p-16 bg-gradient-to-b from-white/[0.03] to-transparent border-r border-white/5 overflow-y-auto max-h-[90vh] lg:max-h-none">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20">
              <ShoppingBag size={20} className="text-white" />
            </div>
            <span className="font-black uppercase tracking-widest text-[12px]">Détails de la commande</span>
          </div>

          <div className="space-y-10">
            <div>
              <h2 className="text-4xl font-black tracking-tighter mb-2">{businessName}</h2>
              <div className="flex items-center gap-2 text-green-500">
                <UserCheck size={14} />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Marchand Certifié Hatex</span>
              </div>
            </div>

            {/* Done Pwodwi */}
            <div className="py-10 border-y border-white/5 space-y-8">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-black rounded-[2.5rem] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                   {sdkData.product_image ? <img src={sdkData.product_image} className="w-full h-full object-cover" /> : <Package className="text-zinc-800" size={40} />}
                </div>
                <div className="flex-1">
                  <p className="text-[16px] font-black uppercase tracking-tight mb-1">{sdkData.product_name}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Quantité: {sdkData.quantity}</p>
                </div>
              </div>

              {/* ENFO LIVREZON (Ki rann paj la long) */}
              <div className="grid grid-cols-1 gap-4 pt-4">
                <div className="flex items-start gap-4 p-5 bg-white/[0.02] rounded-3xl border border-white/5">
                  <MapPin size={18} className="text-red-600 mt-1" />
                  <div>
                    <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Adresse de livraison</p>
                    <p className="text-[11px] font-bold uppercase leading-tight">{sdkData.customer_address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-5 bg-white/[0.02] rounded-3xl border border-white/5">
                  <Phone size={18} className="text-red-600 mt-1" />
                  <div>
                    <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Contact Client</p>
                    <p className="text-[11px] font-bold uppercase tracking-widest">{sdkData.customer_phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-5 bg-white/[0.02] rounded-3xl border border-white/5">
                  <Truck size={18} className="text-red-600 mt-1" />
                  <div>
                    <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Méthode</p>
                    <p className="text-[11px] font-bold uppercase tracking-widest italic">Hatex Express Delivery</p>
                  </div>
                </div>
              </div>
            </div>

            {/* TOTAL */}
            <div className="pt-4">
              <div className="flex justify-between items-end mb-2">
                 <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Net à payer</p>
                 <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold">
                    <ShieldCheck size={12}/> Secure
                 </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-7xl font-black tracking-tighter italic text-white">{amount.toLocaleString()}</span>
                <span className="text-2xl font-black text-red-600">HTG</span>
              </div>
            </div>
          </div>
        </div>

        {/* BÒ DWAT: FÒMILÈ PEMAN */}
        <div className="p-10 lg:p-16 bg-[#0d0e1a] flex flex-col justify-center">
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-3">
              <Lock size={16} className="text-red-600" />
              <div className="h-4 w-[1px] bg-white/10 mx-2"></div>
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-400">Paiement Sécurisé 256-Bit</span>
            </div>
            <div className="flex gap-3">
               <div className="h-6 w-10 bg-white/5 rounded-md border border-white/5 flex items-center justify-center font-black text-[8px] opacity-40 italic">VISA</div>
               <div className="h-6 w-10 bg-white/5 rounded-md border border-white/5 flex items-center justify-center font-black text-[8px] opacity-40 italic">HTX</div>
            </div>
          </div>

          <form onSubmit={handlePayment} className="space-y-10">
            <div className="space-y-4">
              <label className="text-[11px] text-zinc-500 font-black uppercase ml-4 tracking-[0.2em]">Numéro de Carte Hatex</label>
              <div className="relative group">
                <input 
                  required 
                  placeholder="0000 0000 0000 0000" 
                  className="w-full bg-black border border-white/10 p-7 rounded-[2.5rem] text-[18px] font-mono outline-none focus:border-red-600 transition-all placeholder:text-zinc-800" 
                  onChange={e => setForm({...form, card: e.target.value})} 
                />
                <CreditCard className="absolute right-8 top-1/2 -translate-y-1/2 text-zinc-800 group-focus-within:text-red-600 transition-colors" size={24} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[11px] text-zinc-500 font-black uppercase ml-4 tracking-[0.2em]">Expiration</label>
                <input 
                  required 
                  placeholder="MM/YY" 
                  maxLength={5}
                  value={form.expiry}
                  className="w-full bg-black border border-white/10 p-7 rounded-[2.5rem] text-[16px] outline-none text-white italic transition-all focus:border-red-600 text-center" 
                  onChange={e => {
                    let v = e.target.value.replace(/\D/g, '');
                    if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2,4);
                    setForm({...form, expiry: v});
                  }} 
                />
              </div>
              <div className="space-y-4">
                <label className="text-[11px] text-zinc-500 font-black uppercase ml-4 tracking-[0.2em] text-center block">CVV</label>
                <input 
                  required 
                  type="password" 
                  maxLength={3} 
                  placeholder="***" 
                  className="w-full bg-black border border-white/10 p-7 rounded-[2.5rem] text-[16px] outline-none text-center text-white font-mono focus:border-red-600 transition-all" 
                  onChange={e => setForm({...form, cvv: e.target.value})} 
                />
              </div>
            </div>

            <div className="pt-8">
              <button 
                disabled={loading || amount <= 0 || (status.type === 'error' && status.msg.includes('deja peye'))} 
                className="w-full bg-red-600 hover:bg-red-700 py-8 rounded-[3rem] font-black uppercase text-[14px] tracking-[0.3em] shadow-2xl shadow-red-600/30 active:scale-[0.98] transition-all disabled:opacity-20 flex items-center justify-center gap-4"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
                    TRAITEMENT...
                  </>
                ) : (
                  <>
                    <Lock size={20} />
                    PAYER {amount.toLocaleString()} HTG
                  </>
                )}
              </button>
            </div>
          </form>

          {status.msg && (
            <div className={`mt-10 p-7 rounded-[2.5rem] flex items-start gap-4 animate-in slide-in-from-bottom-4 ${status.type === 'error' ? 'bg-red-600/10 border border-red-600/20' : 'bg-green-600/10 border border-green-600/20'}`}>
              <ShieldAlert className={`w-6 h-6 shrink-0 mt-0.5 ${status.type === 'error' ? 'text-red-500' : 'text-green-500'}`} />
              <p className={`text-[12px] font-black uppercase leading-tight italic ${status.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{status.msg}</p>
            </div>
          )}

          <div className="mt-16 text-center space-y-2">
            <p className="text-[9px] text-zinc-700 font-black uppercase tracking-[0.5em]">Hatex Secure Infrastructure v4.2</p>
            <p className="text-[8px] text-zinc-800 font-bold uppercase tracking-[0.2em]">Encrypted & Verified by Hatex Group Haiti</p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="bg-black min-h-screen flex items-center justify-center font-black italic text-red-600">HATEX LOADING...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}