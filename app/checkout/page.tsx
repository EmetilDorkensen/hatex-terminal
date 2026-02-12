"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useMemo, Suspense, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ShieldCheck, Lock, CreditCard, ShoppingBag, 
  AlertCircle, MapPin, User 
} from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // 1. DONE INITIAL YO
  const [amount, setAmount] = useState<number>(0);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('Hatex Secure Pay');
  const [orderId, setOrderId] = useState('PENDING');
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [form, setForm] = useState({ card: '', expiry: '', cvv: '' });

  // Done SDK
  const sdkData = useMemo(() => ({
    platform: searchParams.get('platform') || 'Hatex Gateway',
    customer_name: searchParams.get('customer_name') || '',
    customer_phone: searchParams.get('customer_phone') || '',
    customer_address: searchParams.get('customer_address') || '',
    product_name: searchParams.get('product_name') || 'Paiement Service',
    product_image: searchParams.get('product_image'),
    quantity: parseInt(searchParams.get('quantity') || '1')
  }), [searchParams]);

  // 2. CHACHE DONE INVOICE OUBYEN TERMINAL (FIXED)
  useEffect(() => {
    const initCheckout = async () => {
      const invId = searchParams.get('invoice_id');
      const termId = searchParams.get('terminal');
      const paramAmount = searchParams.get('amount');

      if (invId) {
        // SI SE YON INVOICE
        const { data: inv, error } = await supabase
          .from('invoices')
          .select('*, profiles:owner_id(business_name)')
          .eq('id', invId)
          .single();
        
        if (inv) {
          setAmount(parseFloat(inv.amount)); // Isit la nou fòse montan invoice la
          setReceiverId(inv.owner_id);
          setOrderId(`INV-${inv.id.slice(0, 8).toUpperCase()}`);
          // @ts-ignore
          setBusinessName(inv.profiles?.business_name || 'Hatex Merchant');
        }
      } else if (termId) {
        // SI SE SDK TERMINAL
        setReceiverId(termId);
        setAmount(parseFloat(paramAmount || '0'));
        setOrderId(searchParams.get('order_id') || `TX-${Date.now()}`);
        
        const { data: prof } = await supabase.from('profiles').select('business_name').eq('id', termId).single();
        if (prof) setBusinessName(prof.business_name);
      }
    };
    initCheckout();
  }, [searchParams, supabase]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverId || amount <= 0) {
      return setStatus({ type: 'error', msg: 'Données de paiement invalides.' });
    }

    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      // 3. PWOSESE PEMAN NAN DATABASE
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

      if (data && data.success) {
        // 4. METE INVOICE LA AJOU SI LI EGZISTE
        const invId = searchParams.get('invoice_id');
        if (invId) {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invId);
        }

        // 5. WEBHOOK EMAIL (VOYE DETAY YO)
        // Nou itilize yon try/catch separe pou si email la echwe, sa pa bloke siksè peman an
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
              customer_name: sdkData.customer_name,
              customer_address: sdkData.customer_address,
              customer_phone: sdkData.customer_phone,
              product_name: sdkData.product_name,
              quantity: sdkData.quantity,
              order_id: orderId
            })
          });
        } catch (webhookErr) {
          console.error("Email Webhook Error:", webhookErr);
        }

        // 6. REDIREKSYON SIKSE
        router.push(`/checkout/success?amount=${amount}&id=${data.transaction_id}&order_id=${orderId}`);
      } else {
        throw new Error(data?.message || "Peman an refize pa bank lan.");
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message || "Une erreur est survenue." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[500px] bg-[#0d0e1a] p-8 md:p-12 rounded-[3.5rem] border border-white/5 shadow-2xl relative italic text-white">
      
      <div className="relative z-10">
        <div className="flex justify-center mb-6">
          <div className="bg-red-600/10 p-4 rounded-3xl border border-red-600/20">
            <ShieldCheck className="text-red-600 w-8 h-8" />
          </div>
        </div>

        <h1 className="text-center font-black uppercase text-xl mb-1 tracking-tighter italic">{businessName}</h1>
        <p className="text-center text-zinc-500 text-[9px] font-bold uppercase mb-8 tracking-[0.3em] opacity-50 italic">Hatex Secure Gateway</p>
        
        {/* DETAY PWODWI */}
        {(sdkData.product_name || sdkData.customer_name) && (
          <div className="bg-white/5 p-5 rounded-[2.5rem] mb-6 border border-white/5 space-y-4">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center">
                 {sdkData.product_image ? <img src={sdkData.product_image} className="w-full h-full object-cover" /> : <ShoppingBag className="text-zinc-700" size={20} />}
               </div>
               <div className="text-left flex-1">
                 <p className="text-[10px] font-black uppercase text-white truncate max-w-[200px]">{sdkData.product_name}</p>
                 <p className="text-[8px] text-zinc-500 font-bold uppercase italic">Quantité: {sdkData.quantity}</p>
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-zinc-500">
                  <User size={10} /> <span className="text-[8px] font-black uppercase tracking-tighter">Client</span>
                </div>
                <p className="text-[10px] font-bold text-white truncate">{sdkData.customer_name || 'Hatex User'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-zinc-500">
                  <MapPin size={10} /> <span className="text-[8px] font-black uppercase tracking-tighter">Livraison</span>
                </div>
                <p className="text-[10px] font-bold text-white truncate">{sdkData.customer_address || 'Pétion-Ville, HT'}</p>
              </div>
            </div>
          </div>
        )}

        {/* AMOUNT */}
        <div className="bg-zinc-900/40 p-8 rounded-[2.5rem] mb-8 border border-white/5 text-center">
            <p className="text-[10px] text-zinc-500 uppercase font-black mb-2 italic">Total à payer</p>
            <div className="flex justify-center items-baseline gap-2">
                <p className="text-5xl font-black italic tracking-tighter">{amount.toLocaleString()}</p>
                <p className="text-sm font-black text-red-600">HTG</p>
            </div>
        </div>

        {/* FORM */}
        <form onSubmit={handlePayment} className="space-y-5">
          <div className="space-y-2 text-left">
            <label className="text-[9px] text-zinc-500 font-black uppercase ml-5 tracking-widest italic">Numéro de Carte Hatex</label>
            <input 
              required 
              type="text"
              placeholder="0000 0000 0000 0000" 
              className="w-full bg-black border border-white/10 p-5 rounded-[1.8rem] text-[14px] font-mono outline-none focus:border-red-600/50 text-white" 
              onChange={e => setForm({...form, card: e.target.value})} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input required placeholder="MM/YY" className="w-full bg-black border border-white/10 p-5 rounded-[1.8rem] text-[12px] outline-none text-white italic" 
              onChange={e => setForm({...form, expiry: e.target.value})} />
            <input required type="password" maxLength={3} placeholder="CVV" className="w-full bg-black border border-white/10 p-5 rounded-[1.8rem] text-[12px] outline-none text-center text-white font-mono" 
              onChange={e => setForm({...form, cvv: e.target.value})} />
          </div>

          <button 
            disabled={loading || amount <= 0} 
            className="w-full bg-red-600 py-6 rounded-[1.8rem] font-black uppercase text-[12px] mt-4 shadow-xl active:scale-95 transition-all disabled:opacity-20 text-white"
          >
            {loading ? "AUTHENTIFICATION..." : "PAYER MAINTENANT"}
          </button>
        </form>

        {status.msg && (
          <div className="mt-6 p-4 bg-red-600/10 border border-red-600/20 rounded-[1.5rem] flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-red-500 text-[9px] font-black uppercase italic leading-tight">{status.msg}</p>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-center gap-4 opacity-20">
          <Lock size={12} />
          <span className="text-[8px] font-black uppercase tracking-widest">Secured by Hatex Pay</span>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-[#06070d] text-white flex items-center justify-center p-6 italic font-sans">
      <Suspense fallback={<div className="font-black text-red-600 animate-pulse uppercase">Hatex Pay...</div>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}