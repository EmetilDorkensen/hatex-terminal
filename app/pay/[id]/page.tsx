"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { CreditCard, Lock, Calendar, ShieldCheck } from 'lucide-react';

export default function CheckoutPage() {
  const params = useParams();
  const paymentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [merchantName, setMerchantName] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Enfòmasyon Kat la
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchPaymentDetails = async () => {
      try {
        // Pa gen anyen pou verifye si moun nan konekte (NO LOGIN REQUIRED)

        // 1. Chèche detay fakti a (Tikè Peman an)
        const { data: request, error: reqErr } = await supabase
          .from('payment_requests')
          .select('*')
          .eq('id', paymentId)
          .single();

        if (reqErr || !request) throw new Error("Fakti sa a pa valab oswa li pa egziste ankò.");
        if (request.status === 'completed') throw new Error("Fakti sa a te deja peye.");
        
        setPaymentData(request);

        // 2. Chèche non Machann nan pou n ka afiche l
        const { data: merchantProfile } = await supabase
          .from('profiles')
          .select('business_name, full_name')
          .eq('id', request.merchant_id)
          .single();
          
        if (merchantProfile) {
            setMerchantName(merchantProfile.business_name || merchantProfile.full_name);
        }

      } catch (err: any) {
        setMsg({ type: 'error', text: err.message });
      } finally {
        setLoading(false);
      }
    };

    if (paymentId) fetchPaymentDetails();
  }, [paymentId, supabase]);

  // Fonksyon pou fòmate nimewo kat la bèl ak espas (XXXX XXXX XXXX XXXX)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 16);
    const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
    setCardNumber(formatted);
  };

  // Fonksyon pou fòmate Dat la (MM/YY)
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (value.length >= 3) {
      value = `${value.substring(0, 2)}/${value.substring(2, 4)}`;
    }
    setExpiry(value);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Netwaye espas ak senbòl nan kat la pou voye l pwòp nan baz done a
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    const cleanExpiry = expiry;
    const cleanCvv = cvv;

    if (cleanCardNumber.length < 16) return setMsg({ type: 'error', text: 'Nimewo kat la pa konplè.' });
    if (cleanExpiry.length !== 5) return setMsg({ type: 'error', text: 'Dat ekspirasyon an pa bon.' });
    if (cleanCvv.length < 3) return setMsg({ type: 'error', text: 'CVV a dwe gen omwen 3 chif.' });

    setProcessing(true);
    setMsg({ type: '', text: '' });

    try {
      // 1. Voye enfòmasyon kat la nan nouvo RPC baz done a
      const { data: result, error } = await supabase.rpc('process_merchant_payment_with_card', {
        p_payment_id: paymentId,
        p_card_number: cleanCardNumber,
        p_card_expiry: cleanExpiry,
        p_card_cvv: cleanCvv
      });

      if (error) throw new Error("Gen yon pwoblèm nan sistèm peman an. Tanpri re-eseye.");

      if (result.success) {
        
        // ==========================================
        // 🚨 MAJI WEBHOOK LA FÈT LA A 🚨
        // ==========================================
        if (paymentData.webhook_url) {
            try {
                // Siyal nan fènwa pou di plugin WooCommerce la kòb la nan men Hatex
                await fetch(paymentData.webhook_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order_id: paymentData.order_id,
                        status: 'paid',
                        transaction_id: paymentId,
                        amount_htg: paymentData.amount
                    })
                });
            } catch (webhookErr) {
                console.error("Webhook error ignored");
            }
        }
        // ==========================================

        setMsg({ type: 'success', text: '✅ Peman an pase avèk siksè! N ap voye w tounen...' });
        
        // Voye kliyan an tounen sou sit la apre 2 segonn
        setTimeout(() => {
          window.location.href = result.redirect_url;
        }, 2000);

      } else {
        setMsg({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setProcessing(false);
      setCvv(''); // Efase CVV a imedyatman pou sekirite
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center text-white italic font-black uppercase">Ap chaje paj peman an...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex flex-col items-center justify-center p-6 italic uppercase font-black relative overflow-hidden">
      {/* Background efè */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-red-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-zinc-900/40 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-xl relative z-10">
        
        <div className="text-center mb-8 border-b border-white/5 pb-6">
          <div className="flex justify-center mb-3">
             <ShieldCheck size={40} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">HatexCard Pay</h1>
          <p className="text-[10px] text-zinc-500 tracking-widest">Kès Peman Sekirize (128-bit SSL)</p>
        </div>

        {paymentData && !msg.text.includes('Fakti sa a pa valab') && !msg.text.includes('deja peye') ? (
          <>
            {/* Montan pou peye a */}
            <div className="bg-black/50 p-6 rounded-2xl border border-white/5 mb-8 text-center shadow-inner">
              <p className="text-[9px] text-zinc-500 mb-2">W AP PEYE</p>
              <h2 className="text-xl font-bold truncate mb-4 text-blue-400">{merchantName || "Boutik Pam"}</h2>
              
              <div className="flex justify-between items-end border-t border-white/5 pt-4">
                 <span className="text-[10px] text-zinc-500">KÒMAND #{paymentData.order_id}</span>
                 <span className="text-3xl font-black text-white">{Number(paymentData.amount).toLocaleString()} <span className="text-sm text-red-600">HTG</span></span>
              </div>
            </div>

            {/* Fòmilè Kat la */}
            <form onSubmit={handlePayment} className="space-y-4">
              
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-500 tracking-widest ml-2">NIMEWO KAT HATEX OU</label>
                <div className="relative">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    className="w-full bg-black border border-white/10 p-5 pl-12 rounded-2xl focus:border-red-600 outline-none transition-all font-black text-sm tracking-[0.2em] text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] text-zinc-500 tracking-widest ml-2">DAT (MM/YY)</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={handleExpiryChange}
                      className="w-full bg-black border border-white/10 p-5 pl-12 rounded-2xl focus:border-red-600 outline-none transition-all font-black text-sm tracking-widest text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] text-zinc-500 tracking-widest ml-2">CVC/CVV</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
                    <input
                      type="password"
                      placeholder="•••"
                      maxLength={4}
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-black border border-white/10 p-5 pl-12 rounded-2xl focus:border-red-600 outline-none transition-all font-black text-sm tracking-[0.2em] text-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {msg.text && (
                <div className={`p-4 rounded-xl border mt-4 ${msg.type === 'error' ? 'bg-red-600/10 text-red-500 border-red-600/20' : 'bg-green-600/10 text-green-500 border-green-600/20'}`}>
                   <p className="text-[10px] font-black uppercase text-center leading-relaxed">{msg.text}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={processing || cardNumber.length < 19 || expiry.length < 5 || cvv.length < 3}
                className="w-full bg-red-600 py-5 rounded-2xl font-black uppercase shadow-xl shadow-red-600/20 active:scale-95 transition-all text-sm mt-4 disabled:opacity-50 disabled:shadow-none"
              >
                {processing ? "AP TRETE PEMAN AN..." : `PEYE ${Number(paymentData.amount).toLocaleString()} HTG`}
              </button>
            </form>
          </>
        ) : (
           <div className="text-center py-10">
              <span className="text-4xl mb-4 block">⚠️</span>
              <p className="text-[11px] text-zinc-400 font-bold leading-relaxed">{msg.text}</p>
           </div>
        )}

      </div>
      <div className="mt-8 opacity-40 text-[8px] tracking-[0.4em] flex items-center justify-center gap-2">
         <span className="w-8 h-[1px] bg-zinc-600"></span>
         SECURED BY HATEX GROUP
         <span className="w-8 h-[1px] bg-zinc-600"></span>
      </div>
    </div>
  );
}