"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useMemo, Suspense, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ShieldCheck, Lock, CreditCard, ShoppingBag, 
  AlertCircle, MapPin, User, Phone 
} from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // 1. STATE POU KONTWÒL DONE YO
  const [amount, setAmount] = useState<number>(0);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('Hatex Secure Pay');
  const [orderId, setOrderId] = useState('PENDING');
  const [checkoutType, setCheckoutType] = useState<'invoice' | 'terminal' | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [form, setForm] = useState({ card: '', expiry: '', cvv: '' });

  // 2. REKIPERE DONE SDK (POU TERMINAL SÈLMAN)
  const sdkData = useMemo(() => ({
    platform: searchParams.get('platform') || 'Hatex SDK',
    customer_name: searchParams.get('customer_name') || '',
    customer_phone: searchParams.get('customer_phone') || '',
    customer_address: searchParams.get('customer_address') || '',
    product_name: searchParams.get('product_name') || '',
    product_image: searchParams.get('product_image') || null,
    quantity: parseInt(searchParams.get('quantity') || '1')
  }), [searchParams]);

  // 3. SEPARASYON LOJIK INVOICE AK TERMINAL
  useEffect(() => {
    const initCheckout = async () => {
      const invId = searchParams.get('invoice_id');
      const termId = searchParams.get('terminal');

      if (invId) {
        setCheckoutType('invoice');
        const { data: inv } = await supabase
          .from('invoices')
          .select('*, profiles:owner_id(business_name)')
          .eq('id', invId)
          .single();
        
        if (inv) {
          setAmount(parseFloat(inv.amount)); // Montan strik ki nan invoice la
          setReceiverId(inv.owner_id);
          setOrderId(`INV-${inv.id.slice(0, 8).toUpperCase()}`);
          setBusinessName(inv.profiles?.business_name || 'Hatex Merchant');
        }
      } else if (termId) {
        setCheckoutType('terminal');
        setReceiverId(termId);
        setAmount(parseFloat(searchParams.get('amount') || '0'));
        setOrderId(searchParams.get('order_id') || `SDK-${Date.now().toString().slice(-6)}`);
        
        const { data: prof } = await supabase.from('profiles').select('business_name').eq('id', termId).single();
        if (prof) setBusinessName(prof.business_name);
      }
    };
    initCheckout();
  }, [searchParams, supabase]);

  // 4. FONKSYON PEMAN AK VALIDASYON RIGID
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverId || amount <= 0) return setStatus({ type: 'error', msg: 'Transaction invalide.' });

    // Validasyon fòma kat (Senp men efikas avan RPC a)
    if (form.card.replace(/\s/g, '').length < 12) return setStatus({ type: 'error', msg: 'Numéro de carte invalide.' });
    if (!form.expiry.includes('/')) return setStatus({ type: 'error', msg: 'Date expiration incorrecte (MM/YY).' });

    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      // PWOSESE PEMAN (RPC a dwe tcheke balans ak enfòmasyon kat la nan baz de done a)
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
        // Si se yon invoice, mete l "paid"
        if (checkoutType === 'invoice') {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', searchParams.get('invoice_id'));
        }

        // VOYE WEBHOOK EMAIL (Dwa bay Machann nan)
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resend-email`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ 
            type: checkoutType, // Pou email la konnen si se Invoice oubyen SDK
            transaction_id: data.transaction_id,
            receiver_id: receiverId,
            business_name: businessName,
            amount: amount,
            order_id: orderId,
            // Done sa yo enpòtan pou SDK a
            customer: {
              name: sdkData.customer_name,
              phone: sdkData.customer_phone,
              address: sdkData.customer_address
            },
            product: {
              name: sdkData.product_name,
              image: sdkData.product_image,
              quantity: sdkData.quantity
            }
          })
        }).catch(e => console.error("Email failed", e));

        router.push(`/checkout/success?amount=${amount}&id=${data.transaction_id}&order_id=${orderId}`);
      } else {
        // Erè balans, CVV, oubyen Nimewo Kat
        throw new Error(data?.message || "Échec de l'authentification.");
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message || "Erreur de communication avec la banque." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[500px] bg-[#0d0e1a] p-8 md:p-12 rounded-[3.5rem] border border-white/5 shadow-2xl relative italic text-white">
      <div className="relative z-10">
        <div className="flex justify-center mb-6">
          <div className="bg-red-600/10 p-4 rounded-3xl border border-red-600/20 animate-pulse">
            <ShieldCheck className="text-red-600 w-8 h-8" />
          </div>
        </div>

        <h1 className="text-center font-black uppercase text-xl mb-1 tracking-tighter italic">{businessName}</h1>
        <p className="text-center text-zinc-500 text-[9px] font-bold uppercase mb-8 tracking-[0.3em] opacity-50 italic">
          {checkoutType === 'invoice' ? 'Facture Sécurisée' : 'Terminal SDK Hatex'}
        </p>
        
        {/* BLÒK DONE SDK (SÈLMAN SI SE TERMINAL AK DONE YO PREZAN) */}
        {checkoutType === 'terminal' && sdkData.product_name && (
          <div className="bg-white/5 p-5 rounded-[2.5rem] mb-6 border border-white/5 space-y-4">
            <div className="flex items-center gap-4">
               <div className="w-14 h-14 bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
                 {sdkData.product_image ? <img src={sdkData.product_image} className="w-full h-full object-cover" /> : <ShoppingBag className="text-zinc-700" size={24} />}
               </div>
               <div className="text-left flex-1">
                 <p className="text-[11px] font-black uppercase text-white leading-tight">{sdkData.product_name}</p>
                 <p className="text-[9px] text-red-600 font-black uppercase italic mt-1">Qté: {sdkData.quantity}</p>
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-zinc-500"><User size={10} /> <span className="text-[8px] font-black uppercase">Client</span></div>
                <p className="text-[10px] font-bold text-white truncate">{sdkData.customer_name || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-zinc-500"><MapPin size={10} /> <span className="text-[8px] font-black uppercase">Livraison</span></div>
                <p className="text-[10px] font-bold text-white truncate">{sdkData.customer_address || 'Non spécifiée'}</p>
              </div>
            </div>
          </div>
        )}

        {/* AFFICHAGE MONTANT */}
        <div className="bg-zinc-900/40 p-8 rounded-[2.5rem] mb-8 border border-white/5 text-center shadow-inner">
            <p className="text-[10px] text-zinc-500 uppercase font-black mb-2 italic tracking-widest">Montant Total</p>
            <div className="flex justify-center items-baseline gap-2">
                <p className="text-5xl font-black italic tracking-tighter text-white">{amount.toLocaleString()}</p>
                <p className="text-sm font-black text-red-600">HTG</p>
            </div>
        </div>

        {/* FORMULAIRE DE PAIEMENT */}
        <form onSubmit={handlePayment} className="space-y-5">
          <div className="space-y-2 text-left">
            <label className="text-[9px] text-zinc-500 font-black uppercase ml-5 tracking-widest italic">Carte Hatex (12+ chiffres)</label>
            <input 
              required 
              type="text"
              placeholder="0000 0000 0000 0000" 
              className="w-full bg-black border border-white/10 p-5 rounded-[1.8rem] text-[14px] font-mono outline-none focus:border-red-600/50 text-white transition-all" 
              onChange={e => setForm({...form, card: e.target.value})} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[8px] text-zinc-500 font-black uppercase ml-5 italic">Expiration</label>
              <input required placeholder="MM/YY" className="w-full bg-black border border-white/10 p-5 rounded-[1.8rem] text-[12px] outline-none text-white italic" 
                onChange={e => setForm({...form, expiry: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[8px] text-zinc-500 font-black uppercase ml-5 italic">Code CVV</label>
              <input required type="password" maxLength={3} placeholder="***" className="w-full bg-black border border-white/10 p-5 rounded-[1.8rem] text-[12px] outline-none text-center text-white font-mono" 
                onChange={e => setForm({...form, cvv: e.target.value})} />
            </div>
          </div>

          <button 
            disabled={loading || amount <= 0} 
            className="w-full bg-red-600 py-6 rounded-[1.8rem] font-black uppercase text-[12px] mt-4 shadow-xl active:scale-95 transition-all disabled:opacity-20 text-white"
          >
            {loading ? "VÉRIFICATION BANCAIRE..." : `PAYER ${amount.toLocaleString()} HTG`}
          </button>
        </form>

        {status.msg && (
          <div className="mt-6 p-4 bg-red-600/10 border border-red-600/20 rounded-[1.5rem] flex items-center gap-3 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-red-500 text-[9px] font-black uppercase italic leading-tight">{status.msg}</p>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-center gap-4 opacity-20">
          <Lock size={12} />
          <span className="text-[8px] font-black uppercase tracking-widest">Transaction Cryptée 256-bit</span>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-[#06070d] text-white flex items-center justify-center p-6 italic font-sans">
      <Suspense fallback={<div className="font-black text-red-600 animate-pulse uppercase">Hatex Secure...</div>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}