"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useMemo, Suspense, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ShieldCheck, Lock, ShoppingBag, AlertCircle, 
  MapPin, User, CreditCard 
} from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // STATES POU DONE YO
  const [amount, setAmount] = useState<number>(0);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('Hatex Secure Pay');
  const [orderId, setOrderId] = useState('PENDING');
  const [checkoutType, setCheckoutType] = useState<'invoice' | 'terminal' | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [form, setForm] = useState({ card: '', expiry: '', cvv: '' });

  // DONE SDK YO
  const sdkData = useMemo(() => ({
    platform: searchParams.get('platform') || 'Hatex Gateway',
    customer_name: searchParams.get('customer_name') || '',
    customer_phone: searchParams.get('customer_phone') || '',
    customer_address: searchParams.get('customer_address') || '',
    customer_email: searchParams.get('customer_email') || '',
    product_name: searchParams.get('product_name') || '',
    product_image: searchParams.get('product_image'),
    quantity: parseInt(searchParams.get('quantity') || '1')
  }), [searchParams]);

  // LOJIK POU RALE DONE (INVOICE OUBYEN TERMINAL)
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
    if (form.card.length < 12 || form.cvv.length < 3 || form.expiry.length < 5) {
      return setStatus({ type: 'error', msg: 'Tanpri ranpli tout enfòmasyon kat la.' });
    }

    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      // 1. PWOSESE PEMAN NAN SUPABASE (RPC)
      const { data, error: rpcError } = await supabase.rpc('process_secure_payment', {
        p_terminal_id: receiverId,
        p_card_number: form.card.replace(/\s/g, ''),
        p_card_cvv: form.cvv,
        p_card_expiry: form.expiry,
        p_amount: amount,
        p_order_id: orderId,
        p_customer_name: sdkData.customer_name || 'Client Hatex',
        p_platform: sdkData.platform
      });

      if (rpcError) throw rpcError;

      if (data && data.success) {
        // 2. METE INVOICE LA "PAID" SI SE YON INVOICE
        if (checkoutType === 'invoice') {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', searchParams.get('invoice_id'));
        }

        // 3. VOYE EMAIL VIA EDGE FUNCTION (Payload konpatib ak KA 3)
        const { data: merchantProf } = await supabase.from('profiles').select('email').eq('id', receiverId).single();

        const emailPayload = {
          transaction_id: data.transaction_id,
          business_name: businessName,
          amount: amount,
          sdk: {
            platform: sdkData.platform,
            product_name: sdkData.product_name || (checkoutType === 'invoice' ? 'Paiement Facture' : 'Terminal Pay'),
            product_image: sdkData.product_image,
            customer_name: sdkData.customer_name || "Kliyan Hatex",
            customer_phone: sdkData.customer_phone || "N/A",
            customer_address: sdkData.customer_address || "N/A",
            customer_email: sdkData.customer_email || "", 
            merchant_email: merchantProf?.email || "",
            quantity: sdkData.quantity
          }
        };

        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resend-email`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify(emailPayload)
        }).catch(err => console.error("Email error:", err));

        // REDIREKSYON SIKSE
        router.push(`/checkout/success?amount=${amount}&id=${data.transaction_id}&order_id=${orderId}`);
      } else {
        throw new Error(data?.message || "Echèk peman: Enfòmasyon envalid.");
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[500px] bg-[#0d0e1a] p-8 md:p-12 rounded-[3.5rem] border border-white/5 shadow-2xl relative italic text-white">
      <div className="relative z-10 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-red-600/10 p-4 rounded-3xl border border-red-600/20">
            <ShieldCheck className="text-red-600 w-8 h-8" />
          </div>
        </div>

        <h1 className="font-black uppercase text-xl mb-1 tracking-tighter">{businessName}</h1>
        <p className="text-zinc-500 text-[9px] font-bold uppercase mb-8 tracking-[0.3em] opacity-50">Hatex Secure Gateway</p>
        
        {/* ENFO PWODWI SDK */}
        {checkoutType === 'terminal' && sdkData.product_name && (
          <div className="bg-white/5 p-5 rounded-[2.5rem] mb-6 border border-white/5 text-left">
            <div className="flex items-center gap-4 mb-4">
               <div className="w-14 h-14 bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
                 {sdkData.product_image ? <img src={sdkData.product_image} className="w-full h-full object-cover" /> : <ShoppingBag className="text-zinc-700" size={24} />}
               </div>
               <div>
                 <p className="text-[11px] font-black uppercase text-white">{sdkData.product_name}</p>
                 <p className="text-[9px] text-red-600 font-black uppercase mt-1">Quantité: {sdkData.quantity}</p>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div>
                <span className="text-[8px] font-black text-zinc-500 uppercase">Destinataire</span>
                <p className="text-[10px] font-bold text-white truncate">{sdkData.customer_name || 'Client'}</p>
              </div>
              <div>
                <span className="text-[8px] font-black text-zinc-500 uppercase">Livraison</span>
                <p className="text-[10px] font-bold text-white truncate">{sdkData.customer_address || 'P-V, Haiti'}</p>
              </div>
            </div>
          </div>
        )}

        {/* MONTAN */}
        <div className="bg-zinc-900/40 p-8 rounded-[2.5rem] mb-8 border border-white/5 shadow-inner">
            <p className="text-[10px] text-zinc-500 uppercase font-black mb-2 tracking-widest">Total à débiter</p>
            <div className="flex justify-center items-baseline gap-2">
                <p className="text-5xl font-black italic tracking-tighter">{amount.toLocaleString()}</p>
                <p className="text-sm font-black text-red-600">HTG</p>
            </div>
        </div>

        {/* FÒMILÈ */}
        <form onSubmit={handlePayment} className="space-y-5 text-left">
          <div className="space-y-2">
            <label className="text-[9px] text-zinc-500 font-black uppercase ml-5 italic tracking-widest">Numéro de Carte Hatex</label>
            <input 
              required 
              placeholder="0000 0000 0000 0000" 
              className="w-full bg-black border border-white/10 p-5 rounded-[1.8rem] text-[14px] font-mono outline-none focus:border-red-600 text-white" 
              onChange={e => setForm({...form, card: e.target.value})} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] text-zinc-500 font-black uppercase ml-5 italic">Expiration</label>
              <input 
                required 
                placeholder="MM/YY" 
                maxLength={5}
                value={form.expiry}
                className="w-full bg-black border border-white/10 p-5 rounded-[1.8rem] text-[12px] outline-none text-white italic" 
                onChange={e => {
                  let v = e.target.value.replace(/\D/g, '');
                  if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2,4);
                  setForm({...form, expiry: v});
                }} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] text-zinc-500 font-black uppercase ml-5 italic text-center block">CVV</label>
              <input 
                required 
                type="password" 
                maxLength={3} 
                placeholder="***" 
                className="w-full bg-black border border-white/10 p-5 rounded-[1.8rem] text-[12px] outline-none text-center text-white font-mono" 
                onChange={e => setForm({...form, cvv: e.target.value})} 
              />
            </div>
          </div>

          <button 
            disabled={loading || amount <= 0} 
            className="w-full bg-red-600 py-6 rounded-[1.8rem] font-black uppercase text-[12px] mt-4 shadow-xl active:scale-95 transition-all disabled:opacity-20"
          >
            {loading ? "AUTHENTIFICATION..." : `PAYER ${amount.toLocaleString()} HTG`}
          </button>
        </form>

        {status.msg && (
          <div className="mt-6 p-4 bg-red-600/10 border border-red-600/20 rounded-[1.5rem] flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-red-500 text-[9px] font-black uppercase leading-tight">{status.msg}</p>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-center gap-4 opacity-20">
          <Lock size={12} />
          <span className="text-[8px] font-black uppercase tracking-widest text-white">Secure Encrypted Transaction</span>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-[#06070d] text-white flex items-center justify-center p-6 italic font-sans">
      <Suspense fallback={<div className="font-black text-red-600 animate-pulse">HATEX SECURE...</div>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}