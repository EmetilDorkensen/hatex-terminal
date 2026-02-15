"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useMemo, Suspense, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ShieldCheck, Lock, CreditCard, CheckCircle2, 
  MapPin, Phone, UserCheck, FileText, Download,
  AlertTriangle, Calendar, Building2, Truck, Package,
  ShoppingBag, ArrowRight
} from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // --- STATES ---
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'invoice' | 'sdk'>('sdk');
  
  // Done Tranzaksyon
  const [amount, setAmount] = useState<number>(0);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState('');
  const [businessName, setBusinessName] = useState('Hatex Merchant');
  const [kycStatus, setKycStatus] = useState<string>('');
  
  // Done Invoice (Si se yon fakti)
  const [invoice, setInvoice] = useState<any>(null);
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  // Done SDK (Si se yon livrezon)
  const sdkData = useMemo(() => ({
    product_name: searchParams.get('product_name') || 'Sèvis Digital',
    product_image: searchParams.get('product_image'),
    customer_name: searchParams.get('customer_name') || 'Kliyan',
    customer_address: searchParams.get('customer_address') || 'N/A',
    customer_phone: searchParams.get('customer_phone') || 'N/A',
    customer_email: searchParams.get('customer_email') || '',
    quantity: searchParams.get('quantity') || '1',
    platform: searchParams.get('platform') || 'Hatex Gateway'
  }), [searchParams]);

  // Fòm Peman
  const [form, setForm] = useState({ card: '', expiry: '', cvv: '' });
  const [errorMsg, setErrorMsg] = useState('');

  // --- 1. CHAJMAN ENFÒMASYON ---
  useEffect(() => {
    const init = async () => {
      const invId = searchParams.get('invoice_id');
      const termId = searchParams.get('terminal');

      try {
        if (invId) {
          // --- MÒD INVOICE (Sekirite Baz Done) ---
          setCheckoutType('invoice');
          const { data: inv, error } = await supabase
            .from('invoices')
            .select('*, profiles:owner_id(business_name, kyc_status, email, phone)')
            .eq('id', invId)
            .single();

          if (error || !inv) throw new Error("Fakti sa a pa valab.");

          setInvoice(inv);
          setReceiverId(inv.owner_id);
          setAmount(inv.amount); // Pri a soti nan DB a, pa nan URL la
          setBusinessName(inv.profiles?.business_name || 'Komèsan Hatex');
          setKycStatus(inv.profiles?.kyc_status);
          setOrderId(`INV-${inv.id.slice(0, 8).toUpperCase()}`);
          
          if (inv.status === 'paid') setAlreadyPaid(true);

        } else if (termId) {
          // --- MÒD SDK (Livrezon) ---
          setCheckoutType('sdk');
          setReceiverId(termId);
          setAmount(parseFloat(searchParams.get('amount') || '0'));
          setOrderId(searchParams.get('order_id') || `TX-${Date.now().toString().slice(-6)}`);
          
          const { data: prof } = await supabase
            .from('profiles')
            .select('business_name, kyc_status')
            .eq('id', termId)
            .single();
            
          if (prof) {
            setBusinessName(prof.business_name);
            setKycStatus(prof.kyc_status);
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [searchParams, supabase]);

  // --- 2. LOGIC PEMAN ---
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setErrorMsg('');

    try {
      if (!receiverId || amount <= 0) throw new Error("Konfigirasyon peman envalid.");

      // Si se invoice, verifye ankò si l poko peye
      if (checkoutType === 'invoice') {
        const { data: check } = await supabase.from('invoices').select('status').eq('id', invoice.id).single();
        if (check?.status === 'paid') {
          setAlreadyPaid(true);
          setProcessing(false);
          return;
        }
      }

      // Rele Fonksyon SQL la
      const { data, error: rpcError } = await supabase.rpc('process_secure_payment', {
        p_terminal_id: receiverId,
        p_card_number: form.card.replace(/\s/g, ''),
        p_card_cvv: form.cvv,
        p_card_expiry: form.expiry,
        p_amount: amount,
        p_order_id: orderId,
        p_customer_name: checkoutType === 'invoice' ? invoice.client_email : sdkData.customer_name,
        p_platform: checkoutType === 'invoice' ? 'Hatex Invoice' : sdkData.platform
      });

      if (rpcError) throw rpcError;

      if (data.success) {
        if (checkoutType === 'invoice') {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice.id);
          setAlreadyPaid(true); // Montre ekran siksè a
        } else {
          router.push(`/checkout/success?amount=${amount}&id=${data.transaction_id}&order_id=${orderId}`);
        }
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Echèk tranzaksyon.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#06070d] flex items-center justify-center text-red-600 font-black animate-pulse">CHARGEMENT...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-900/30">
      <div className="max-w-6xl mx-auto min-h-screen grid grid-cols-1 lg:grid-cols-2">
        
        {/* --- KOLÒN GÒCH: ENFÒMASYON --- */}
        <div className="p-8 lg:p-16 flex flex-col relative overflow-hidden bg-white/[0.02]">
          {/* Background Effects */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-transparent"></div>
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-red-600/10 rounded-full blur-[80px]"></div>

          <div className="mb-10">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
                <Building2 size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">{businessName}</h1>
                <div className="flex items-center gap-2">
                   {kycStatus === 'approved' && (
                     <span className="flex items-center gap-1 text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded border border-green-500/20 font-black uppercase tracking-wider">
                       <CheckCircle2 size={10} /> Verifié
                     </span>
                   )}
                   <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">ID: {orderId}</span>
                </div>
              </div>
            </div>
          </div>

          {/* KONTN DYNAMIK: SDK vs INVOICE */}
          <div className="flex-1 space-y-8">
            
            {/* 1. MÒD SDK (LIVREZON) */}
            {checkoutType === 'sdk' && (
              <>
                 <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="w-16 h-16 bg-black rounded-xl border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                       {sdkData.product_image ? <img src={sdkData.product_image} className="w-full h-full object-cover" /> : <Package size={24} className="text-zinc-700"/>}
                    </div>
                    <div>
                       <h3 className="font-bold text-sm uppercase">{sdkData.product_name}</h3>
                       <p className="text-[10px] text-zinc-500 font-black uppercase tracking-wider mt-1">Quantité: {sdkData.quantity}</p>
                    </div>
                 </div>

                 {/* ENFÒMASYON LIVREZON YO (Yo Retounen!) */}
                 <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest pl-1">Détails de Livraison</p>
                    
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                       <MapPin className="text-red-500" size={18} />
                       <div>
                          <p className="text-[10px] text-zinc-500 uppercase font-bold">Adresse</p>
                          <p className="text-sm font-medium">{sdkData.customer_address}</p>
                       </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                       <Phone className="text-red-500" size={18} />
                       <div>
                          <p className="text-[10px] text-zinc-500 uppercase font-bold">Contact</p>
                          <p className="text-sm font-medium">{sdkData.customer_phone}</p>
                       </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                       <Truck className="text-red-500" size={18} />
                       <div>
                          <p className="text-[10px] text-zinc-500 uppercase font-bold">Méthode</p>
                          <p className="text-sm font-medium italic">Hatex Express Delivery</p>
                       </div>
                    </div>
                 </div>
              </>
            )}

            {/* 2. MÒD INVOICE (DOKIMAN) */}
            {checkoutType === 'invoice' && (
               <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                     <FileText className="text-zinc-400" size={20} />
                     <span className="text-sm font-black uppercase tracking-widest">Récapitulatif de la Facture</span>
                  </div>
                  
                  <div className="flex justify-between border-b border-white/10 pb-4">
                     <span className="text-zinc-400 text-sm">Client</span>
                     <span className="font-medium text-sm">{invoice?.client_email}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-4">
                     <span className="text-zinc-400 text-sm">Date d'émission</span>
                     <span className="font-medium text-sm">{new Date(invoice?.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                     <span className="text-white font-bold">Total Facturé</span>
                     <span className="text-xl font-black italic">{amount.toLocaleString()} HTG</span>
                  </div>
               </div>
            )}

            <div className="pt-8 border-t border-white/10">
               <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Total à payer</span>
                  <div className="flex items-baseline gap-2">
                     <span className="text-4xl lg:text-5xl font-black tracking-tighter text-white">{amount.toLocaleString()}</span>
                     <span className="text-xl font-bold text-red-600">HTG</span>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* --- KOLÒN DWAT: PEMAN --- */}
        <div className="bg-[#0a0b12] p-8 lg:p-20 flex flex-col justify-center border-l border-white/5">
          
          {alreadyPaid ? (
             // EKRAN SIKSÈ (Pou Invoice)
             <div className="text-center space-y-8 animate-in zoom-in-50 duration-500">
                <div className="w-20 h-20 bg-green-500 rounded-full mx-auto flex items-center justify-center shadow-2xl shadow-green-500/30">
                   <CheckCircle2 size={32} className="text-black" />
                </div>
                <div>
                   <h2 className="text-3xl font-black uppercase tracking-tight">Facture Payée</h2>
                   <p className="text-zinc-400 mt-2">Mèsi. Tranzaksyon sa a konplete.</p>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 text-left space-y-2">
                   <div className="flex justify-between text-sm"><span className="text-zinc-500">Ref</span> <span className="text-white font-mono">{orderId}</span></div>
                   <div className="flex justify-between text-sm"><span className="text-zinc-500">Montant</span> <span className="text-green-400 font-bold">{amount.toLocaleString()} HTG</span></div>
                </div>
                <button className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
                   <Download size={18}/> Télécharger Reçu
                </button>
             </div>
          ) : (
             // FÒM PEMAN
             <div className="space-y-8">
               <div>
                  <h2 className="text-2xl font-bold mb-2">Paiement Sécurisé</h2>
                  <p className="text-zinc-500 text-sm">Ranpli detay kat Hatex ou a pou konfime.</p>
               </div>

               <form onSubmit={handlePayment} className="space-y-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-1">Numéro de Carte</label>
                     <div className="relative group">
                        <input 
                           required 
                           placeholder="0000 0000 0000 0000"
                           className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 transition-all font-mono text-lg placeholder:text-zinc-800"
                           onChange={e => setForm({...form, card: e.target.value})}
                        />
                        <CreditCard className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-red-500 transition-colors" size={20}/>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-1">Expiration</label>
                        <input 
                           required 
                           placeholder="MM/YY"
                           maxLength={5}
                           className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 transition-all text-center text-lg placeholder:text-zinc-800"
                           onChange={e => {
                              let v = e.target.value.replace(/\D/g, '');
                              if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2,4);
                              setForm({...form, expiry: v});
                           }}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-1">CVC</label>
                        <div className="relative group">
                           <input 
                              required type="password" maxLength={3} placeholder="***"
                              className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 transition-all text-center text-lg placeholder:text-zinc-800 font-mono"
                              onChange={e => setForm({...form, cvv: e.target.value})}
                           />
                           <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-red-500 transition-colors" size={16}/>
                        </div>
                     </div>
                  </div>

                  <button 
                     disabled={processing || alreadyPaid}
                     className="w-full bg-red-600 hover:bg-red-700 py-6 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-red-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     {processing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                     ) : (
                        <>PAYER MAINTENANT <ArrowRight size={18}/></>
                     )}
                  </button>
               </form>

               {errorMsg && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 animate-in slide-in-from-bottom-2">
                     <AlertTriangle size={18} />
                     <p className="text-xs font-bold uppercase">{errorMsg}</p>
                  </div>
               )}

               <div className="flex items-center justify-center gap-2 opacity-30 pt-4">
                  <ShieldCheck size={12} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Secured by Hatex Gateway</span>
               </div>
             </div>
          )}
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