"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useMemo, Suspense, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ShieldCheck, Lock, CreditCard, Calendar, Key, ShoppingBag, AlertCircle, CheckCircle2 } from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Done ki soti nan SDK a
  const sdkData = useMemo(() => ({
    platform: searchParams.get('platform'),
    customer_name: searchParams.get('customer_name'),
    customer_phone: searchParams.get('customer_phone'),
    customer_address: searchParams.get('customer_address'),
    product_name: searchParams.get('product_name'),
    product_image: searchParams.get('product_image'),
    product_url: searchParams.get('product_url'),
    quantity: parseInt(searchParams.get('quantity') || '1')
  }), [searchParams]);

  const [amount, setAmount] = useState(parseFloat(searchParams.get('amount') || '0'));
  const [terminalId, setTerminalId] = useState(searchParams.get('terminal'));
  const [orderId, setOrderId] = useState(searchParams.get('order_id') || 'N/A');
  const [businessName, setBusinessName] = useState('Hatex Secure Pay');
  
  const invoiceId = searchParams.get('invoice_id');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [form, setForm] = useState({ name: '', card: '', expiry: '', cvv: '' });

  // Rekipere kontèks (Invoice oswa Terminal)
  useEffect(() => {
    const fetchInvoice = async () => {
      if (invoiceId) {
        const { data } = await supabase.from('invoices').select('*, profiles(business_name)').eq('id', invoiceId).single();
        if (data) {
          setAmount(data.amount);
          setTerminalId(data.owner_id);
          setOrderId(`INV-${data.id.slice(0, 5)}`);
          setBusinessName(data.profiles?.business_name || 'Hatex Merchant');
        }
      } else if (terminalId) {
        const { data } = await supabase.from('profiles').select('business_name').eq('id', terminalId).single();
        if (data) setBusinessName(data.business_name);
      }
    };
    fetchInvoice();
  }, [invoiceId, terminalId, supabase]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      // 1. Rele RPC a pou validation kat, KYC, Balans, ak Transfè
      const { data, error } = await supabase.rpc('process_secure_payment', {
        p_terminal_id: terminalId,
        p_card_number: form.card.replace(/\s/g, ''),
        p_amount: amount,
        p_order_id: orderId,
        p_customer_name: sdkData.customer_name || 'Kliyan Hatex',
        p_customer_phone: sdkData.customer_phone || 'N/A',
        p_platform: sdkData.platform || 'Checkout Direct'
      });

      if (error) throw error;

      if (data.success) {
        // 2. Si se yon Invoice, make li kòm peye
        if (invoiceId) {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId);
        }

        // 3. Webhook pou Email (Opsyonèl si ou genyen l toujou)
        try {
          const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resend-email`;
          await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ 
              transaction_id: data.transaction_id,
              business_name: businessName,
              amount: amount,
              sdk: { ...sdkData }
            })
          });
        } catch (e) { console.log("Email skip"); }

        // 4. Redireksyon sou paj siksè
        router.push(`/checkout/success?amount=${amount}&id=${data.transaction_id}&order_id=${orderId}`);
      } else {
        throw new Error(data.message || "Erè nan peman an");
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] bg-[#0d0e1a] p-8 md:p-12 rounded-[3.5rem] border border-white/5 shadow-2xl relative italic text-white overflow-hidden">
      
      {/* GLOW EFFECT */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/10 blur-[100px] rounded-full"></div>
      
      <div className="relative z-10">
        <div className="flex justify-center mb-8">
          <div className="bg-red-600/10 p-4 rounded-3xl border border-red-600/20">
            <ShieldCheck className="text-red-600 w-8 h-8" />
          </div>
        </div>

        <h1 className="text-center font-black uppercase text-xl mb-1 tracking-tighter">{businessName}</h1>
        <p className="text-center text-zinc-500 text-[9px] font-bold uppercase mb-10 tracking-[0.3em] opacity-50">Secure Gateway</p>
        
        {/* PRODUCT CARD */}
        {sdkData.product_name && (
          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-[2rem] mb-6 border border-white/5">
            <div className="w-14 h-14 bg-black rounded-2xl overflow-hidden border border-white/10 shrink-0">
              <img src={sdkData.product_image || "/api/placeholder/100/100"} alt="product" className="w-full h-full object-cover" />
            </div>
            <div className="text-left overflow-hidden">
              <p className="text-[11px] font-black text-white uppercase truncate">{sdkData.product_name}</p>
              <div className="flex items-center gap-2 mt-1">
                <ShoppingBag className="w-3 h-3 text-red-600" />
                <p className="text-[9px] text-zinc-500 font-bold uppercase">QTY: {sdkData.quantity}</p>
              </div>
            </div>
          </div>
        )}

        {/* AMOUNT DISPLAY */}
        <div className="bg-zinc-900/40 p-8 rounded-[2.5rem] mb-8 border border-white/5 text-center relative">
          <p className="text-[10px] text-zinc-500 uppercase font-black mb-2">Total à régler</p>
          <div className="flex justify-center items-baseline gap-2">
            <p className="text-5xl font-black italic tracking-tighter">{amount.toLocaleString()}</p>
            <p className="text-sm font-black text-red-600">HTG</p>
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handlePayment} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[9px] text-zinc-500 font-black uppercase ml-5">Numéro de Carte Hatex</label>
            <div className="relative">
              <input 
                required 
                placeholder="0000 0000 0000 0000" 
                className="w-full bg-black border border-white/10 p-5 rounded-[1.5rem] text-[13px] font-mono outline-none focus:border-red-600/50 transition-all text-white placeholder:opacity-20" 
                onChange={e => setForm({...form, card: e.target.value})} 
              />
              <CreditCard className="absolute right-6 top-5 text-zinc-700 w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] text-zinc-500 font-black uppercase ml-5">Expiration</label>
              <div className="relative">
                <input 
                  required 
                  placeholder="MM/YY" 
                  className="w-full bg-black border border-white/10 p-5 rounded-[1.5rem] text-[12px] outline-none focus:border-red-600/50 text-white" 
                  onChange={e => setForm({...form, expiry: e.target.value})} 
                />
                <Calendar className="absolute right-6 top-5 text-zinc-700 w-4 h-4" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] text-zinc-500 font-black uppercase ml-5">CVV</label>
              <input 
                required 
                type="password" 
                maxLength={3} 
                placeholder="***" 
                className="w-full bg-black border border-white/10 p-5 rounded-[1.5rem] text-[12px] outline-none text-center focus:border-red-600/50 text-white" 
                onChange={e => setForm({...form, cvv: e.target.value})} 
              />
            </div>
          </div>

          <button 
            disabled={loading} 
            className="w-full bg-red-600 py-6 rounded-[1.5rem] font-black uppercase text-[12px] mt-6 shadow-2xl shadow-red-600/20 active:scale-[0.98] transition-all disabled:opacity-50 text-white flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                VÉRIFICATION...
              </>
            ) : (
              "PAYER MAINTENANT"
            )}
          </button>
        </form>

        {/* STATUS MESSAGE */}
        {status.msg && (
          <div className="mt-8 p-5 bg-red-600/10 border border-red-600/20 rounded-[1.5rem] flex items-center gap-4 animate-in slide-in-from-bottom-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-red-500 text-[10px] font-black uppercase leading-tight tracking-tight">{status.msg}</p>
          </div>
        )}

        {/* FOOTER */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col items-center gap-4 opacity-40">
          <div className="flex items-center gap-3">
             <Lock className="w-3 h-3" />
             <span className="text-[8px] font-black uppercase tracking-[0.2em]">SSL Secured Payment</span>
          </div>
          <div className="flex gap-4">
             <div className="h-[1px] w-10 bg-white/20"></div>
             <p className="text-[7px] font-black uppercase">Powered by HatexCard</p>
             <div className="h-[1px] w-10 bg-white/20"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-[#06070d] text-white flex items-center justify-center p-6 italic font-sans selection:bg-red-600">
      <Suspense fallback={<div className="font-black uppercase italic animate-pulse text-red-600">Initialisation...</div>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}