"use client";
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Lock, CreditCard, CheckCircle2, 
  MapPin, Phone, FileText, Download,
  AlertTriangle, Building2, Truck, Package,
  ArrowRight, ShieldCheck, Images, ShoppingCart, User
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
  
  const [amount, setAmount] = useState<number>(0);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState('');
  const [businessName, setBusinessName] = useState('Hatex Merchant');
  const [kycStatus, setKycStatus] = useState<string>('');
  
  const [invoice, setInvoice] = useState<any>(null);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // --- NOUVO SDK DATA ---
  // Nou ajoute tout nouvo paramèt yo (shop_name, quantity, color, size, vs)
  const sdkData = useMemo(() => ({
    shop_name: searchParams.get('shop_name') || searchParams.get('platform') || 'Hatex Gateway',
    product_name: searchParams.get('product_name') || 'Sèvis Digital',
    product_image: searchParams.get('product_image'),
    quantity: searchParams.get('quantity') || '1',
    color: searchParams.get('color'),
    size: searchParams.get('size'),
    customer_name: searchParams.get('customer_name') || 'Kliyan',
    customer_address: searchParams.get('customer_address') || 'N/A',
    customer_phone: searchParams.get('customer_phone') || 'N/A',
    platform: searchParams.get('platform') || 'Hatex Gateway'
  }), [searchParams]);

  // Ajoute First Name ak Last Name nan fòm nan pou verifikasyon
  const [form, setForm] = useState({ firstName: '', lastName: '', card: '', expiry: '', cvv: '' });

  // --- FONKSYON POU BOUCHE NON AN (Eme...) ---
  const maskName = (name: string) => {
    if (!name) return "Kli...";
    const base = name.includes('@') ? name.split('@')[0] : name;
    return base.substring(0, 3) + "...";
  };

  // --- VERIFIKASYON KAT (FRONTEND) ---
  const validateForm = () => {
    const cardNumber = form.card.replace(/\s/g, '');
    if (cardNumber.length < 15 || cardNumber.length > 19) return "Nimewo kat la pa gen bon longè.";
    
    if (form.cvv.length < 3 || form.cvv.length > 4) return "Kòd CVV/CVC a dwe gen 3 oswa 4 chif.";
    
    if (!form.firstName.trim() || !form.lastName.trim()) return "Tanpri mete non ak siyati egzakteman jan li sou kat la.";
    
    const [month, year] = form.expiry.split('/');
    if (!month || !year || month.length !== 2 || year.length !== 2) return "Fòma dat la dwe MM/YY.";
    
    const currentYear = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;
    if (Number(year) < currentYear || (Number(year) === currentYear && Number(month) < currentMonth)) {
      return "Kat sa a sanble li espire deja.";
    }
    
    return null; // Pa gen erè
  };

  // --- 1. INITIALIZATION & DETECTION ---
  useEffect(() => {
    const init = async () => {
      const invId = searchParams.get('invoice_id');
      const termId = searchParams.get('terminal');

      try {
        if (invId) {
          // --- PATI INVOICE LA PA CHANJE ---
          setCheckoutType('invoice');
          const { data: inv, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', invId)
            .single();

          if (error || !inv) throw new Error("Fakti sa a pa valid oswa li pa egziste.");

          setInvoice(inv);
          setReceiverId(inv.owner_id);
          setAmount(Number(inv.amount));
          
          const { data: prof } = await supabase
            .from('profiles')
            .select('business_name, kyc_status')
            .eq('id', inv.owner_id)
            .single();
            
          if (prof) {
            setBusinessName(prof.business_name || 'Hatex Merchant');
            setKycStatus(prof.kyc_status);
          }
          
          setOrderId(`INV-${inv.id.slice(0, 8).toUpperCase()}`);
          if (inv.status === 'paid') setAlreadyPaid(true);

        } else if (termId) {
          // --- PATI SDK LA ---
          setCheckoutType('sdk');
          setReceiverId(termId);
          
          // Nou asire nou pri a miltipliye pa kantite a si SDK a pa t gentan fè sa
          const unitPrice = Number(searchParams.get('amount')) || 0;
          const qty = Number(searchParams.get('quantity')) || 1;
          // Si ou vle pou total la se unitPrice * qty, ou ka dekomante liy anba a:
          // setAmount(unitPrice * qty); 
          // Pou kounye a nou kenbe pri ki vini nan URL la kòm total la:
          setAmount(unitPrice); 

          setOrderId(searchParams.get('order_id') || `SDK-${Math.random().toString(36).slice(2, 9)}`);
          
          const { data: prof } = await supabase
            .from('profiles')
            .select('business_name, kyc_status')
            .eq('id', termId)
            .single();

          if (prof) {
            // Machann lan dwe apwouve (KYC)
            setBusinessName(prof.business_name || 'Hatex Merchant');
            setKycStatus(prof.kyc_status);
          }
        }
      } catch (err: any) {
        setErrorMsg("Enposib pou chaje tranzaksyon an.");
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

    // Verifikasyon entèlijan fwonnyè an
    const validationError = validateForm();
    if (validationError) {
      setErrorMsg(validationError);
      setProcessing(false);
      return;
    }

    try {
      if (!receiverId || amount <= 0) throw new Error("Erè konfigirasyon: Montan envalid.");

      const rawCustomerName = checkoutType === 'invoice' ? (invoice?.client_email || 'Kliyan Invoice') : sdkData.customer_name;
      const maskedName = maskName(rawCustomerName);

      // Nou prepare yon objè METADATA pou voye tout enfòmasyon yo bay backend la.
      // C'est nan backend la y'ap itilize metadata sa pou voye email bay machann nan.
      const transactionMetadata = {
        shop_name: sdkData.shop_name,
        product_name: sdkData.product_name,
        quantity: sdkData.quantity,
        color: sdkData.color,
        size: sdkData.size,
        card_holder_name: `${form.firstName} ${form.lastName}`
      };

      // Nou voye done yo nan RPC a
      const { data, error: rpcError } = await supabase.rpc('process_secure_payment', {
        p_terminal_id: receiverId,
        p_card_number: form.card.replace(/\s/g, ''),
        p_card_cvv: form.cvv,
        p_card_expiry: form.expiry,
        p_amount: amount,
        p_order_id: orderId,
        p_customer_name: maskedName, 
        p_platform: checkoutType === 'invoice' ? `Invoice: ${businessName}` : sdkData.platform,
        // Ou DWE ajoute p_metadata nan fonksyon RPC ou a sou Supabase poul ka resevwa sa:
        p_metadata: transactionMetadata 
      });

      if (rpcError) throw rpcError;

      if (data.success) {
        if (checkoutType === 'invoice') {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice.id);
          setAlreadyPaid(true);
        } else {
          setAlreadyPaid(true); // Olye nou fè redirect, nou ka montre resi a la tou pou kliyan an wè notifikasyon an
          // router.push(`/checkout/success?amount=${amount}&id=${data.transaction_id}&order_id=${orderId}&merchant=${businessName}`);
        }
      } else {
        throw new Error(data.message || "Fonds insuffisants ou kat pa pase.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Echèk tranzaksyon. Verifye kat ou.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-red-600 font-black text-xs uppercase tracking-widest animate-pulse">Chargement Hatex...</p>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-900/30">
      <div className="max-w-6xl mx-auto min-h-screen grid grid-cols-1 lg:grid-cols-2">
        
        {/* --- KOLÒN GÒCH: ENFÒMASYON --- */}
        <div className="p-8 lg:p-16 flex flex-col relative overflow-hidden bg-white/[0.02] border-r border-white/5">
          <div className="mb-10 flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-red-600 to-red-900 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20">
              <Building2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase">
                {checkoutType === 'sdk' ? sdkData.shop_name : businessName}
              </h1>
              <div className="flex items-center gap-2">
                 {kycStatus === 'approved' && (
                   <span className="flex items-center gap-1 text-[9px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded border border-green-500/20 font-black uppercase tracking-wider">
                     <CheckCircle2 size={10} /> Verifié
                   </span>
                 )}
                 <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">REF: {orderId}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-8">
            {checkoutType === 'sdk' && (
              <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                 {/* PWODWI DETAILS */}
                 <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 mb-6 relative">
                    <div className="w-20 h-20 bg-black rounded-xl border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                       {sdkData.product_image ? <img src={sdkData.product_image} className="w-full h-full object-cover" alt="product" /> : <Package size={24} className="text-zinc-700"/>}
                    </div>
                    <div className="flex-1">
                       <h3 className="font-bold text-sm uppercase text-white mb-2">{sdkData.product_name}</h3>
                       
                       <div className="flex flex-wrap gap-2 mb-2">
                          {/* KANTITE */}
                          <span className="inline-flex items-center gap-1 text-[10px] bg-white/10 px-2 py-1 rounded text-zinc-300 font-bold tracking-wider">
                            <ShoppingCart size={10} /> QTY: {sdkData.quantity}
                          </span>
                          {/* KOULÈ */}
                          {sdkData.color && (
                            <span className="inline-flex items-center text-[10px] bg-white/10 px-2 py-1 rounded text-zinc-300 font-bold tracking-wider">
                              Koulè: <span className="w-2 h-2 rounded-full ml-1 border border-white/30" style={{backgroundColor: sdkData.color}}></span> {sdkData.color}
                            </span>
                          )}
                          {/* SIZE */}
                          {sdkData.size && (
                            <span className="inline-flex items-center text-[10px] bg-white/10 px-2 py-1 rounded text-zinc-300 font-bold tracking-wider">
                              Size: {sdkData.size}
                            </span>
                          )}
                       </div>

                       <p className="text-[9px] text-zinc-500 font-black uppercase tracking-wider">Platform: {sdkData.platform}</p>
                    </div>
                 </div>
                 
                 <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest pl-1">Livraison</p>
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                       <MapPin className="text-red-500" size={18} />
                       <div>
                          <p className="text-[9px] text-zinc-500 uppercase font-bold">Adresse</p>
                          <p className="text-sm font-medium">{sdkData.customer_address}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                       <Phone className="text-red-500" size={18} />
                       <div>
                          <p className="text-[9px] text-zinc-500 uppercase font-bold">Contact</p>
                          <p className="text-sm font-medium">{sdkData.customer_phone}</p>
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {checkoutType === 'invoice' && (
               <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-3xl p-8 space-y-6 animate-in zoom-in-95 duration-500">
                  <div className="flex items-center gap-3 mb-4">
                     <FileText className="text-zinc-400" size={20} />
                     <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Facture Hatex</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between border-b border-white/5 pb-4">
                       <span className="text-zinc-500 text-sm">Client</span>
                       <span className="font-bold text-sm text-white">{invoice?.client_email}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-4">
                       <span className="text-zinc-500 text-sm">Montant</span>
                       <span className="font-bold text-sm text-red-500">{amount.toLocaleString()} HTG</span>
                    </div>
                  </div>
               </div>
            )}

            <div className="pt-8 mt-auto">
               <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Total à payer</span>
                  <div className="flex items-baseline gap-2">
                     <span className="text-5xl lg:text-6xl font-black tracking-tighter text-white">{amount.toLocaleString()}</span>
                     <span className="text-xl font-bold text-red-600">HTG</span>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* --- KOLÒN DWAT: PEMAN --- */}
        <div className="bg-[#0a0b12] p-8 lg:p-20 flex flex-col justify-center">
          
          {alreadyPaid ? (
             <div className="text-center space-y-8 animate-in zoom-in-50 duration-500">
                <div className="w-24 h-24 bg-green-500 rounded-full mx-auto flex items-center justify-center shadow-[0_0_40px_-10px_rgba(34,197,94,0.6)]">
                   <CheckCircle2 size={40} className="text-black" />
                </div>
                <div>
                   <h2 className="text-3xl font-black uppercase tracking-tight italic">Paiement Reçu</h2>
                   
                   {/* MESAJ DETAYE POU KLIYAN AN JAN OU TE MANDE A */}
                   <div className="mt-4 p-5 rounded-2xl bg-green-500/10 border border-green-500/20 text-left">
                      <p className="text-green-500 text-xs font-black uppercase mb-2 tracking-widest">Istorik Tranzaksyon</p>
                      <p className="text-white text-sm leading-relaxed">
                        Felisitasyon! Ou achte pou <span className="font-bold text-green-400">{amount.toLocaleString()} HTG</span> nan biznis <span className="font-bold">"{checkoutType === 'sdk' ? sdkData.shop_name : businessName}"</span> jodi a ({new Date().toLocaleDateString()}). 
                        {checkoutType === 'sdk' && ` Ou sot achte: ${sdkData.quantity}x ${sdkData.product_name}.`}
                      </p>
                   </div>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 text-left space-y-3">
                   <div className="flex justify-between text-sm"><span className="text-zinc-500">Ref ID</span> <span className="text-white font-mono">{orderId}</span></div>
                   <div className="flex justify-between text-sm"><span className="text-zinc-500">Montant</span> <span className="text-green-400 font-bold">{amount.toLocaleString()} HTG</span></div>
                </div>
                <button onClick={() => window.print()} className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
                   <Download size={18}/> Télécharger Reçu
                </button>
             </div>
          ) : (
             <div className="space-y-8">
               <div>
                  <h2 className="text-2xl font-bold mb-2">Paiement Sécurisé</h2>
                  <p className="text-zinc-500 text-sm">Antre enfòmasyon kat Hatex ou pou peye.</p>
               </div>

               <form onSubmit={handlePayment} className="space-y-6">
                  
                  {/* NOUVO: Non ak Siyati sou Kat la */}
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-1">Prénom (First Name)</label>
                        <div className="relative group">
                           <input 
                              required 
                              placeholder="John"
                              className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 transition-all text-sm placeholder:text-zinc-800 text-white"
                              onChange={e => setForm({...form, firstName: e.target.value})}
                           />
                           <User className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-red-500 transition-colors" size={16}/>
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-1">Nom (Last Name)</label>
                        <div className="relative group">
                           <input 
                              required 
                              placeholder="Doe"
                              className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 transition-all text-sm placeholder:text-zinc-800 text-white"
                              onChange={e => setForm({...form, lastName: e.target.value})}
                           />
                        </div>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-1">Numéro de Carte</label>
                     <div className="relative group">
                        <input 
                           required 
                           placeholder="0000 0000 0000 0000"
                           className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 transition-all font-mono text-lg placeholder:text-zinc-800 text-white"
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
                           className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 transition-all text-center text-lg placeholder:text-zinc-800 text-white font-mono"
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
                              required type="password" maxLength={4} placeholder="***"
                              className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 transition-all text-center text-lg placeholder:text-zinc-800 font-mono text-white"
                              onChange={e => setForm({...form, cvv: e.target.value})}
                           />
                           <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-red-500 transition-colors" size={16}/>
                        </div>
                     </div>
                  </div>

                  <button 
                     disabled={processing || alreadyPaid}
                     className="w-full bg-red-600 hover:bg-red-700 py-6 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-red-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-6 disabled:opacity-50 disabled:cursor-not-allowed text-white"
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
                     <AlertTriangle size={18} className="shrink-0" />
                     <p className="text-xs font-bold uppercase">{errorMsg}</p>
                  </div>
               )}

               <div className="flex items-center justify-center gap-2 opacity-30 pt-4">
                  <ShieldCheck size={12} className="text-white" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Secured by Hatex Gateway & KYC Verified</span>
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