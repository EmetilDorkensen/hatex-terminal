"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useMemo, Suspense, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ShieldCheck, Lock, CreditCard, Calendar, 
  ShoppingBag, AlertCircle, MapPin, Phone, User 
} from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // 1. REKIPERE TOUT DONE LIVREZON AK PWODWI
  const sdkData = useMemo(() => ({
    platform: searchParams.get('platform') || 'Hatex Gateway',
    customer_name: searchParams.get('customer_name') || '',
    customer_phone: searchParams.get('customer_phone') || '',
    customer_address: searchParams.get('customer_address') || '',
    product_name: searchParams.get('product_name'),
    product_image: searchParams.get('product_image'),
    product_url: searchParams.get('product_url'),
    quantity: parseInt(searchParams.get('quantity') || '1')
  }), [searchParams]);

  const [amount, setAmount] = useState(parseFloat(searchParams.get('amount') || '0'));
  const [receiverId, setReceiverId] = useState(searchParams.get('terminal'));
  const [orderId, setOrderId] = useState(searchParams.get('order_id') || 'PENDING');
  const [businessName, setBusinessName] = useState('Hatex Secure Pay');
  
  const invoiceId = searchParams.get('invoice_id');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [form, setForm] = useState({ card: '', expiry: '', cvv: '' });

  // 2. LOJIK POU INVOICE AK TERMINAL (KONTWÒL MOUN K AP RESEVWA KÒB LA)
  useEffect(() => {
    const initCheckout = async () => {
      if (invoiceId) {
        // Si se yon invoice, chèche mèt invoice la ak montan an
        const { data: inv } = await supabase
          .from('invoices')
          .select('*, profiles:owner_id(business_name)')
          .eq('id', invoiceId)
          .single();
        
        if (inv) {
          setAmount(inv.amount);
          setReceiverId(inv.owner_id);
          setOrderId(`INV-${inv.id.slice(0, 8).toUpperCase()}`);
          // @ts-ignore
          setBusinessName(inv.profiles?.business_name || 'Hatex Merchant');
        }
      } else if (receiverId) {
        // Si se yon SDK Terminal
        const { data: prof } = await supabase.from('profiles').select('business_name').eq('id', receiverId).single();
        if (prof) setBusinessName(prof.business_name);
      }
    };
    initCheckout();
  }, [invoiceId, receiverId, supabase]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      // 3. VALIDASYON SEKIRITE (KAT, KYC, BALANS, TRANSFÈ OTOMATIK)
      const { data, error: rpcError } = await supabase.rpc('process_secure_payment', {
        p_terminal_id: receiverId,
        p_card_number: form.card.replace(/\s/g, ''),
        p_amount: amount,
        p_order_id: orderId,
        p_customer_name: sdkData.customer_name,
        p_customer_phone: sdkData.customer_phone,
        p_platform: sdkData.platform
      });

      if (rpcError) throw rpcError;

      if (data.success) {
        // 4. METE INVOICE LA AJOU SI SE YON INVOICE
        if (invoiceId) {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId);
        }

        // 5. WEBHOOK EMAIL (Voye foto, detay livrezon bay machann ak kliyan)
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resend-email`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ 
              transaction_id: data.transaction_id,
              receiver_id: receiverId,
              business_name: businessName,
              amount: amount,
              customer: {
                name: sdkData.customer_name,
                address: sdkData.customer_address,
                phone: sdkData.customer_phone
              },
              product: {
                name: sdkData.product_name,
                image: sdkData.product_image,
                quantity: sdkData.quantity
              }
            })
          });
        } catch (webhookErr) {
          console.error("Email error:", webhookErr);
        }

        // 6. REDIREKSYON SIKSE
        router.push(`/checkout/success?amount=${amount}&id=${data.transaction_id}&order_id=${orderId}`);
      } else {
        throw new Error(data.message || "Peman an refize");
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[500px] bg-[#0d0e1a] p-8 md:p-12 rounded-[3.5rem] border border-white/5 shadow-2xl relative italic text-white">
      
      {/* HEADER */}
      <div className="relative z-10">
        <div className="flex justify-center mb-6">
          <div className="bg-red-600/10 p-4 rounded-3xl border border-red-600/20">
            <ShieldCheck className="text-red-600 w-8 h-8" />
          </div>
        </div>

        <h1 className="text-center font-black uppercase text-xl mb-1 tracking-tighter italic">{businessName}</h1>
        <p className="text-center text-zinc-500 text-[9px] font-bold uppercase mb-8 tracking-[0.3em] opacity-50 italic">Hatex Secure Gateway</p>
        
        {/* DETAY PWODWI AK LIVREZON (SI YO PREZAN) */}
        {(sdkData.product_name || sdkData.customer_name) && (
          <div className="bg-white/5 p-5 rounded-[2.5rem] mb-6 border border-white/5 space-y-4">
            {sdkData.product_name && (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-black rounded-2xl overflow-hidden border border-white/10 shrink-0">
                  <img src={sdkData.product_image || "/placeholder.png"} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-black uppercase text-white leading-tight">{sdkData.product_name}</p>
                  <p className="text-[9px] text-red-600 mt-1 font-black uppercase italic">Qty: {sdkData.quantity}</p>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-zinc-500">
                  <User size={10} /> <span className="text-[8px] font-black uppercase">Client</span>
                </div>
                <p className="text-[10px] font-bold text-white truncate">{sdkData.customer_name || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-zinc-500">
                  <MapPin size={10} /> <span className="text-[8px] font-black uppercase">Livraison</span>
                </div>
                <p className="text-[10px] font-bold text-white truncate">{sdkData.customer_address || 'Hatex Pickup'}</p>
              </div>
            </div>
          </div>
        )}

        {/* AMOUNT DISPLAY */}
        <div className="bg-zinc-900/40 p-8 rounded-[2.5rem] mb-8 border border-white/5 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10"><ShoppingBag size={40} /></div>
            <p className="text-[10px] text-zinc-500 uppercase font-black mb-2">Montant de la Transaction</p>
            <div className="flex justify-center items-baseline gap-2">
                <p className="text-5xl font-black italic tracking-tighter">{amount.toLocaleString()}</p>
                <p className="text-sm font-black text-red-600">HTG</p>
            </div>
        </div>

        {/* PAYMENT FORM */}
        <form onSubmit={handlePayment} className="space-y-5">
          <div className="space-y-2 text-left">
            <label className="text-[9px] text-zinc-500 font-black uppercase ml-5 tracking-widest">Numéro de Carte Hatex</label>
            <div className="relative">
              <input 
                required 
                placeholder="0000 0000 0000 0000" 
                className="w-full bg-black border border-white/10 p-5 rounded-[1.8rem] text-[14px] font-mono outline-none focus:border-red-600/50 transition-all text-white" 
                onChange={e => setForm({...form, card: e.target.value})} 
              />
              <CreditCard className="absolute right-6 top-5 text-zinc-700 w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 text-left">
              <label className="text-[9px] text-zinc-500 font-black uppercase ml-5 tracking-widest">Expiration</label>
              <input required placeholder="MM/YY" className="w-full bg-black border border-white/10 p-5 rounded-[1.8rem] text-[12px] outline-none focus:border-red-600/50 text-white" 
                onChange={e => setForm({...form, expiry: e.target.value})} />
            </div>
            <div className="space-y-2 text-left">
              <label className="text-[9px] text-zinc-500 font-black uppercase ml-5 tracking-widest">CVV</label>
              <input required type="password" maxLength={3} placeholder="***" className="w-full bg-black border border-white/10 p-5 rounded-[1.8rem] text-[12px] outline-none text-center focus:border-red-600/50 text-white" 
                onChange={e => setForm({...form, cvv: e.target.value})} />
            </div>
          </div>

          <button 
            disabled={loading} 
            className="w-full bg-red-600 py-6 rounded-[1.8rem] font-black uppercase text-[12px] mt-6 shadow-2xl shadow-red-600/20 active:scale-[0.97] transition-all disabled:opacity-50 text-white"
          >
            {loading ? "TRAITEMENT SÉCURISÉ..." : "CONFIRMER LE PAIEMENT"}
          </button>
        </form>

        {status.msg && (
          <div className="mt-8 p-5 bg-red-600/10 border border-red-600/20 rounded-[1.8rem] flex items-center gap-4 animate-bounce-short">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-red-500 text-[10px] font-black uppercase leading-tight italic">{status.msg}</p>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-center gap-4 opacity-30">
          <Lock className="w-3 h-3 text-white" />
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white">SSL 256-BIT ENCRYPTION</span>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-[#06070d] text-white flex items-center justify-center p-6 italic font-sans">
      <Suspense fallback={<div className="font-black uppercase italic animate-pulse text-red-600">Initialisation...</div>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}