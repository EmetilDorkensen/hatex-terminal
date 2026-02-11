"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useMemo, Suspense, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ShieldCheck, Lock, CreditCard, Calendar, Key } from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

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
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [form, setForm] = useState({ name: '', card: '', expiry: '', cvv: '' });

  useEffect(() => {
    const fetchInvoice = async () => {
      if (invoiceId) {
        const { data } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
        if (data) {
          setAmount(data.amount);
          setTerminalId(data.owner_id);
          setOrderId(`INV-${data.id.slice(0, 5)}`);
          setBusinessName(data.business_name || 'Hatex Merchant');
        }
      }
    };
    fetchInvoice();
  }, [invoiceId, supabase]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const { data, error } = await supabase.rpc('process_sdk_payment', {
        p_terminal_id: terminalId,
        p_card_number: form.card,
        p_amount: amount,
        p_order_id: orderId,
        p_otp_code: showOtp ? otpCode : null,
        p_platform: sdkData.platform,
        p_customer_name: sdkData.customer_name,
        p_customer_phone: sdkData.customer_phone,
        p_customer_address: sdkData.customer_address,
        p_product_name: sdkData.product_name,
        p_product_image: sdkData.product_image,
        p_product_url: sdkData.product_url,
        p_quantity: sdkData.quantity
      });

      if (error) throw error;

      if (data.require_otp) {
        setShowOtp(true);
        setLoading(false);
        return;
      }

      if (data.success) {
        // --- DEBLOKAJ WEBHOOK LA ---
        try {
          const PROJECT_ID = "psdnklsqttyqhqhkhmgq"; 
          await fetch(`https://${PROJECT_ID}.supabase.co/functions/v1/hatex-webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              transaction_id: data.transaction_id,
              business_name: businessName,
              sdk: sdkData 
            })
          });
        } catch (wError) {
          console.log("Webhook failed but payment secured");
        }

        if (invoiceId) {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId);
        }
        
        router.push(`/checkout/success?amount=${amount}&id=${data.transaction_id}&order_id=${orderId}`);
      } else {
        throw new Error(data.error || "Erè enkoni");
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[450px] bg-[#0d0e1a] p-10 rounded-[3rem] border border-white/5 shadow-2xl relative italic text-white">
      <div className="flex justify-center mb-6">
        <div className="bg-red-600/10 p-3 rounded-2xl border border-red-600/20">
          <ShieldCheck className="text-red-600 w-6 h-6" />
        </div>
      </div>

      <h1 className="text-center text-white font-black uppercase text-lg mb-1">{businessName}</h1>
      <p className="text-center text-zinc-500 text-[9px] font-bold uppercase mb-8">Peman Sekirize #{orderId}</p>
      
      {sdkData.product_name && (
        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl mb-4 border border-white/5">
          <img src={sdkData.product_image || ""} alt="product" className="w-10 h-10 rounded-lg object-cover" />
          <div className="text-left">
            <p className="text-[10px] font-black text-white uppercase">{sdkData.product_name}</p>
            <p className="text-[8px] text-zinc-500 font-bold uppercase">Kantite: {sdkData.quantity}</p>
          </div>
        </div>
      )}

      <div className="bg-zinc-900/50 p-6 rounded-3xl mb-8 border border-white/5 text-center">
        <p className="text-[9px] text-zinc-500 uppercase font-black mb-1">Montan pou Peye</p>
        <p className="text-3xl font-black italic">{amount.toLocaleString()} <span className="text-sm text-red-600">HTG</span></p>
      </div>

      <form onSubmit={handlePayment} className="space-y-4">
        {!showOtp ? (
          <>
            <div className="space-y-1">
              <label className="text-[8px] text-zinc-500 font-black uppercase ml-4">Nimewo Kat Hatex</label>
              <div className="relative">
                <input required placeholder="0000 0000 0000 0000" className="w-full bg-black border border-white/5 p-4 rounded-2xl text-[11px] outline-none focus:border-red-600/50 transition-all text-white" 
                  onChange={e => setForm({...form, card: e.target.value})} />
                <CreditCard className="absolute right-4 top-4 text-zinc-700 w-4 h-4" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[8px] text-zinc-500 font-black uppercase ml-4">Dat Expirasyon</label>
                <div className="relative">
                  <input required placeholder="MM/YY" className="w-full bg-black border border-white/5 p-4 rounded-2xl text-[11px] outline-none focus:border-red-600/50 transition-all text-white" 
                    onChange={e => setForm({...form, expiry: e.target.value})} />
                  <Calendar className="absolute right-4 top-4 text-zinc-700 w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] text-zinc-500 font-black uppercase ml-4">CVV</label>
                <input required type="password" maxLength={3} placeholder="***" className="w-full bg-black border border-white/5 p-4 rounded-2xl text-[11px] outline-none text-center focus:border-red-600/50 transition-all text-white" 
                  onChange={e => setForm({...form, cvv: e.target.value})} />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-red-600/5 p-4 rounded-2xl border border-red-600/10 text-center">
              <p className="text-[10px] text-red-500 font-black uppercase">Verifikasyon Sekirite</p>
              <p className="text-[9px] text-zinc-500 mt-1 uppercase">Tape kòd 6 chif ou resevwa nan imèl ou a</p>
            </div>
            <div className="relative">
              <input required placeholder="KÒD OTP" className="w-full bg-black border border-red-600/30 p-5 rounded-2xl text-center text-lg font-black tracking-[1em] outline-none text-white" 
                onChange={e => setOtpCode(e.target.value)} />
              <Key className="absolute right-4 top-5 text-red-600 w-4 h-4" />
            </div>
          </div>
        )}
        <button disabled={loading} className="w-full bg-red-600 py-6 rounded-2xl font-black uppercase text-[11px] mt-4 shadow-lg shadow-red-600/20 active:scale-95 transition-all disabled:opacity-50 text-white">
          {loading ? "TRAITEMENT..." : showOtp ? "KONFIME KÒD LA" : "PAYER MAINTENANT"}
        </button>
      </form>
      {status.msg && <p className="mt-4 text-red-500 text-[9px] text-center font-black uppercase">{status.msg}</p>}
      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-4 opacity-30">
        <Lock className="w-3 h-3 text-white" />
        <span className="text-[8px] font-black uppercase tracking-widest text-white">SSL 256-BIT ENCRYPTION</span>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex items-center justify-center p-6 italic font-sans">
      <Suspense fallback={<div className="font-black uppercase italic animate-pulse">Chargement...</div>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}