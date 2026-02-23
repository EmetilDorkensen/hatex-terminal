"use client";
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Lock, CreditCard, CheckCircle2, 
  MapPin, Phone, FileText, Download,
  AlertTriangle, Building2, Package,
  ArrowRight, ShieldCheck, ShoppingCart, User,
  Globe, Info, Mail, Truck, Hash, 
  ExternalLink, CreditCardIcon
} from 'lucide-react';

// Konpozan Loading pou Suspense
const LoadingScreen = () => (
  <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4">
    <div className="w-12 h-12 border-4 border-red-600/20 border-t-red-600 rounded-full animate-spin"></div>
    <div className="flex flex-col items-center">
      <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Chargement Sécurisé</p>
      <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-[0.3em] mt-1">Hatex Gateway v6.0</p>
    </div>
  </div>
);

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // State Management
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'invoice' | 'sdk'>('sdk');
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Data State
  const [amount, setAmount] = useState<number>(0);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState('');
  const [businessName, setBusinessName] = useState('Hatex Merchant');
  const [kycStatus, setKycStatus] = useState<string>('');
  const [invoice, setInvoice] = useState<any>(null);

  // Form State
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    card: '',
    expiry: '',
    cvv: ''
  });

  // SDK Metadata - DEKODE TOUT ENFÒMASYON NÈF YO
  const sdkData = useMemo(() => {
    const token = searchParams.get('token');
    let decodedData: any = {};
    
    if (token) {
        try {
            decodedData = JSON.parse(decodeURIComponent(escape(atob(token))));
        } catch(e) {
            console.error("Impossible de décoder le token SDK");
        }
    }

    // 1. Jesyon Pwodwi yo (sipòte miltip pwodwi nan nouvo sdk a)
    let productList = [];
    if (decodedData.order_details?.items && Array.isArray(decodedData.order_details.items)) {
        productList = decodedData.order_details.items;
    } else if (Array.isArray(decodedData.cart)) {
        productList = decodedData.cart;
    } else if (decodedData.product_name || decodedData.product) {
        productList = [{
            name: decodedData.product_name || decodedData.product || 'Achat Boutique',
            img: decodedData.image || decodedData.img || null,
            qty: decodedData.quantity || 1,
            price: decodedData.price || 0,
            variant: decodedData.variant || ''
        }];
    }

    const allProductNames = productList.map((p: any) => 
      `${p.qty || p.quantity || 1}x ${p.name || p.product_name}`
    ).join(', ');

    return {
      shop_name: decodedData.shop_name || searchParams.get('shop_name') || 'Hatex Merchant',
      products: productList,
      all_product_names_string: allProductNames || 'Achat Multiple',
      
      // 2. Enfòmasyon Livrezon (NÈF)
      subtotal: decodedData.order_details?.subtotal || 0,
      shipping_fee: decodedData.order_details?.shipping_fee || 0,
      shipping_zone: decodedData.order_details?.shipping_zone || 'Non spécifiée',
      
      // 3. Enfòmasyon Kliyan (NÈF)
      customer_name: decodedData.customer?.full_name || decodedData.customer?.n || searchParams.get('customer_name') || 'Kliyan Anonyme',
      customer_email: decodedData.customer?.email || decodedData.customer_email || 'client@hatex.com',
      customer_phone: decodedData.customer?.phone || decodedData.customer?.p || 'Non spécifié',
      customer_address: decodedData.customer?.address || decodedData.customer?.a || 'Non spécifiée',
      
      platform: "Hatex SDK v6",
      terminal: decodedData.terminal || searchParams.get('terminal'),
      total_amount: decodedData.amount || Number(searchParams.get('amount')) || 0,
    };
  }, [searchParams]);

  const maskName = (name: string) => {
    if (!name || name === 'Kliyan Anonyme') return "Kliyan";
    const base = name.split(' ')[0];
    return base.length > 5 ? base.substring(0, 4) + "..." : base;
  };

  useEffect(() => {
    const initCheckout = async () => {
      const invId = searchParams.get('invoice_id');
      const termId = sdkData.terminal;

      try {
        if (invId) {
          // PATI INVOICE LA (ENTAK)
          setCheckoutType('invoice');
          const { data: inv, error } = await supabase.from('invoices').select('*').eq('id', invId).single();
          if (error || !inv) throw new Error("Fakti sa a pa valid.");
          
          setInvoice(inv);
          setReceiverId(inv.owner_id);
          setAmount(Number(inv.amount));
          setOrderId(`INV-${inv.id.slice(0, 8).toUpperCase()}`);
          if (inv.status === 'paid') setAlreadyPaid(true);

          const { data: prof } = await supabase.from('profiles').select('business_name, kyc_status').eq('id', inv.owner_id).single();
          if (prof) {
            setBusinessName(prof.business_name || 'Hatex Merchant');
            setKycStatus(prof.kyc_status);
          }
        } else if (termId) {
          // PATI SDK A
          setCheckoutType('sdk');
          setReceiverId(termId);
          setAmount(sdkData.total_amount);
          setOrderId(searchParams.get('order_id') || `HTX-${Math.random().toString(36).slice(2, 9).toUpperCase()}`);
          
          const { data: prof } = await supabase.from('profiles').select('business_name, kyc_status').eq('id', termId).single();
          if (prof) {
            setBusinessName(prof.business_name || 'Hatex Merchant');
            setKycStatus(prof.kyc_status);
          }
        } else {
            throw new Error("Terminal ID ou Invoice ID manquant.");
        }
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    };

    initCheckout();
  }, [searchParams, supabase, sdkData]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setErrorMsg('');

    try {
      if (!receiverId || amount <= 0) throw new Error("Montan peman an pa kòrèk.");

      const rawCustomerName = checkoutType === 'invoice' ? (invoice?.client_email || 'Kliyan') : sdkData.customer_name;

      const paymentPayload = {
        p_terminal_id: receiverId,
        p_card_number: form.card.replace(/\s/g, ''),
        p_card_cvv: form.cvv,
        p_card_expiry: form.expiry,
        p_amount: amount,
        p_order_id: orderId,
        p_customer_name: maskName(rawCustomerName), 
        p_platform: checkoutType === 'invoice' ? `Invoice: ${businessName}` : sdkData.platform,
        p_metadata: { 
            ...sdkData,
            card_holder: `${form.firstName} ${form.lastName}`,
            full_customer_name: rawCustomerName,
            checkout_timestamp: new Date().toISOString()
        }
      };

      const { data, error: rpcError } = await supabase.rpc('process_secure_payment', paymentPayload);

      if (rpcError) throw rpcError;

      if (data.success) {
        if (checkoutType === 'invoice') {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice.id);
        } else if (data.transaction_id) {
            // Mizajou tranzaksyon an ak tout detay livrezon yo
            await supabase.from('transactions').update({
                customer_name: rawCustomerName,
                customer_email: sdkData.customer_email,
                customer_phone: sdkData.customer_phone,
                customer_address: `${sdkData.shipping_zone} | ${sdkData.customer_address}`,
                product_name: sdkData.all_product_names_string,
                type: 'SALE'
            }).eq('id', data.transaction_id);
        }
        
        // Notification API pou Machann nan
        try {
             await fetch('/api/send-merchant-receipt', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     merchantId: receiverId,
                     amount: amount,
                     orderId: orderId,
                     customer: {
                        name: rawCustomerName,
                        phone: sdkData.customer_phone,
                        address: sdkData.customer_address,
                        zone: sdkData.shipping_zone
                     },
                     items: sdkData.products
                 })
             });
        } catch(e) { console.log("Silent Error: Mail notification failed.") }

        setAlreadyPaid(true);
      } else {
        throw new Error(data.message || "La transaction a été déclinée.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur technique lors du paiement.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-red-600/30 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        
        {/* ========================================================= */}
        {/* SIDEBAR DETAY LÒD (GÒCH) */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 p-6 lg:p-12 bg-white/[0.01] border-r border-white/5 flex flex-col h-full max-h-screen overflow-y-auto custom-scrollbar">
          
          {/* Header Machann */}
          <div className="flex items-center gap-4 mb-10 sticky top-0 bg-[#050505]/80 backdrop-blur-md z-20 py-4">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-600/20 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
              <Building2 size={26} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter leading-none mb-1.5">
                {businessName}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {kycStatus === 'approved' && (
                  <span className="flex items-center gap-1 text-[8px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full border border-green-500/20 font-black uppercase tracking-widest">
                    <CheckCircle2 size={10}/> Vérifié
                  </span>
                )}
                <span className="flex items-center gap-1 text-[9px] text-zinc-600 font-mono tracking-tighter bg-white/5 px-2 py-0.5 rounded">
                   <Hash size={10}/> {orderId}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-10">
            {checkoutType === 'sdk' ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {/* 1. LIS PWODWI YO */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2">
                            <ShoppingCart size={12} className="text-red-600"/> Votre Panier
                        </p>
                        <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-zinc-400 font-bold">{sdkData.products.length} Items</span>
                    </div>
                    
                    <div className="space-y-3">
                        {sdkData.products.map((item: any, index: number) => (
                            <div key={index} className="group relative bg-zinc-900/40 border border-white/5 p-4 rounded-[2rem] flex gap-4 hover:bg-zinc-900/60 hover:border-red-600/20 transition-all duration-300">
                                <div className="w-20 h-20 bg-black rounded-2xl border border-white/5 overflow-hidden flex-shrink-0 shadow-2xl group-hover:scale-105 transition-transform">
                                    {item.img || item.image ? (
                                        <img src={item.img || item.image} alt="product" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-800 bg-zinc-900"><Package size={28}/></div>
                                    )}
                                </div>
                                <div className="flex flex-col justify-center flex-1 min-w-0">
                                    <h3 className="font-bold text-[13px] uppercase text-zinc-100 leading-tight truncate">
                                        {item.name || 'Produit'}
                                    </h3>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <span className="text-[9px] bg-black/50 border border-white/5 px-2 py-1 rounded-lg text-zinc-400 font-black">QTY: {item.qty || item.quantity || 1}</span>
                                        {item.variant && (
                                          <span className="text-[9px] bg-red-600/5 border border-red-600/10 px-2 py-1 rounded-lg text-red-500 font-black uppercase italic">
                                            {item.variant}
                                          </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right flex flex-col justify-center">
                                    <p className="text-sm font-black text-white">{(Number(item.price || 0) * Number(item.qty || item.quantity || 1)).toLocaleString()}</p>
                                    <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">HTG</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. ENFÒMASYON LIVREZON */}
                <div className="bg-zinc-900/30 border border-white/5 rounded-[2.5rem] overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                            <Truck size={14} className="text-red-600"/> Expédition
                        </p>
                        <div className="flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                           <span className="text-[10px] font-black text-white uppercase italic">{sdkData.shipping_zone}</span>
                        </div>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        <div className="flex items-start gap-4 group">
                            <div className="p-3 bg-red-600/10 rounded-2xl text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all duration-500">
                                <User size={18}/>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase text-zinc-500 mb-1 tracking-tighter">Destinataire</p>
                                <p className="text-sm font-bold text-zinc-200">{sdkData.customer_name}</p>
                                <p className="text-[11px] text-zinc-500 font-medium mt-0.5">{sdkData.customer_phone}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 group">
                            <div className="p-3 bg-red-600/10 rounded-2xl text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all duration-500">
                                <MapPin size={18}/>
                            </div>
                            <div className="flex-1">
                                <p className="text-[9px] font-black uppercase text-zinc-500 mb-1 tracking-tighter">Adresse Précise</p>
                                <p className="text-[13px] font-medium text-zinc-300 leading-relaxed italic">
                                    "{sdkData.customer_address}"
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

              </div>
            ) : (
              /* --- PATI INVOICE LA (PA TOUCHE) --- */
              <div className="bg-zinc-900/30 border border-white/5 rounded-[2.5rem] p-8 space-y-8 animate-in fade-in duration-500">
                <div className="flex items-center justify-between border-b border-white/5 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-zinc-400">
                        <FileText size={20}/>
                    </div>
                    <span className="text-xs font-black uppercase text-white tracking-widest">Détails de Facture</span>
                  </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-start gap-5">
                        <div className="p-4 bg-red-600/10 rounded-2xl text-red-500"><Mail size={24}/></div>
                        <div>
                            <span className="text-[10px] text-zinc-500 font-black uppercase block mb-1.5 tracking-widest">Envoyé à</span>
                            <span className="text-lg font-bold text-white block underline decoration-red-600/30 underline-offset-4 tracking-tight">
                                {invoice?.client_email}
                            </span>
                        </div>
                    </div>

                    <div className="p-5 bg-red-600/5 border border-red-600/10 rounded-2xl flex gap-4 items-start">
                        <Info size={20} className="text-red-500 flex-shrink-0 mt-0.5"/>
                        <p className="text-[11px] text-red-400/80 font-bold leading-relaxed uppercase tracking-tighter">
                            Cette facture est protégée par Hatex Secure. Le paiement doit être effectué en une seule transaction.
                        </p>
                    </div>
                </div>
              </div>
            )}
          </div>

          {/* TOTAL FOOTER SECTION */}
          <div className="mt-12 pt-8 border-t border-white/5 sticky bottom-0 bg-[#050505] z-30 pb-6">
              {checkoutType === 'sdk' && Number(sdkData.shipping_fee) > 0 && (
                <div className="flex justify-between items-center mb-6 px-2 text-[10px] font-black uppercase tracking-widest">
                   <span className="text-zinc-500">Articles & Taxes: {sdkData.subtotal.toLocaleString()}</span>
                   <span className="text-red-500">Livraison: +{sdkData.shipping_fee.toLocaleString()}</span>
                </div>
              )}

              <div className="flex items-end justify-between px-2">
                <div>
                   <p className="text-[10px] font-black uppercase text-zinc-600 tracking-[0.3em] mb-3">Total à Transférer</p>
                   <div className="flex items-baseline gap-3">
                      <span className="text-6xl lg:text-7xl font-black tracking-tighter italic text-white">
                        {amount.toLocaleString()}
                      </span>
                      <span className="text-2xl font-black text-red-600 italic">HTG</span>
                   </div>
                </div>
                <div className="text-right pb-2">
                   <div className="bg-green-500/10 text-green-500 text-[8px] font-black uppercase py-1 px-3 rounded-full border border-green-500/20 inline-flex items-center gap-1 mb-2">
                      <ShieldCheck size={10}/> 100% Encrypté
                   </div>
                   <p className="text-[9px] text-zinc-700 font-mono tracking-tighter uppercase">Transaction ID: HTX-{Math.floor(Math.random()*90000)}</p>
                </div>
              </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION PEYE AK KAT (DWAT) */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 bg-[#08090f] p-6 lg:p-24 flex flex-col justify-center relative overflow-hidden">
          
          {/* Animated Background Gradients */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-red-600/5 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2 opacity-30"></div>
          
          <div className="relative z-10 max-w-md mx-auto w-full">
            {alreadyPaid ? (
              <div className="text-center space-y-10 animate-in zoom-in-95 duration-1000">
                <div className="relative inline-block">
                    <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20 animate-pulse"></div>
                    <div className="w-28 h-28 bg-green-500 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-2xl rotate-12 transition-transform hover:rotate-0 duration-500">
                      <CheckCircle2 size={56} className="text-black" />
                    </div>
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-5xl font-black uppercase italic tracking-tighter text-white">Succès !</h2>
                  <p className="text-zinc-500 text-sm font-medium max-w-[280px] mx-auto">Votre paiement a été traité. Un reçu a été envoyé au marchand.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-6">
                  <button onClick={() => window.print()} className="w-full bg-white text-black py-5 rounded-[1.2rem] font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all active:scale-95">
                    <Download size={18}/> Imprimer le reçu officiel
                  </button>
                  <button 
                    onClick={() => {
                        if(checkoutType === 'sdk') window.history.back();
                        else router.push('/');
                    }} 
                    className="w-full bg-white/5 border border-white/10 py-5 rounded-[1.2rem] font-black uppercase text-[10px] tracking-[0.3em] text-zinc-400 hover:bg-white/10 hover:text-white transition-all"
                  >
                    Retourner sur le site
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                <div className="flex items-center justify-between">
                   <div className="space-y-1">
                      <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3">
                        Paiement <CreditCardIcon className="text-red-600" size={24}/>
                      </h2>
                      <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest">Hatex Secure Gateway v6</p>
                   </div>
                   <div className="flex -space-x-2">
                      <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shadow-xl z-20"><Globe size={14} className="text-zinc-500"/></div>
                      <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shadow-xl z-10"><Lock size={14} className="text-zinc-500"/></div>
                   </div>
                </div>

                <form onSubmit={handlePayment} className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 ml-1 tracking-widest">Prénom titulaire</label>
                      <input required placeholder="Prénom" className="w-full bg-black/50 border border-white/5 p-4 rounded-2xl outline-none focus:border-red-600/50 focus:bg-black transition-all text-sm font-bold text-white placeholder:text-zinc-800" onChange={e => setForm({...form, firstName: e.target.value})} />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 ml-1 tracking-widest">Nom de famille</label>
                      <input required placeholder="Nom" className="w-full bg-black/50 border border-white/5 p-4 rounded-2xl outline-none focus:border-red-600/50 focus:bg-black transition-all text-sm font-bold text-white placeholder:text-zinc-800" onChange={e => setForm({...form, lastName: e.target.value})} />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black uppercase text-zinc-500 ml-1 tracking-widest">Numéro de la Carte Hatex</label>
                    <div className="relative group">
                      <input required placeholder="0000 0000 0000 0000" className="w-full bg-black/50 border border-white/5 p-5 rounded-2xl outline-none focus:border-red-600 focus:bg-black transition-all font-mono tracking-[0.3em] text-sm text-white placeholder:text-zinc-800" 
                        onChange={e => {
                          let v = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                          setForm({...form, card: v});
                        }} 
                        maxLength={19}
                      />
                      <CreditCard className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-red-600 transition-colors" size={20}/>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 ml-1 tracking-widest">Date Expiration</label>
                      <input required placeholder="MM / YY" maxLength={5} className="w-full bg-black/50 border border-white/5 p-5 rounded-2xl outline-none focus:border-red-600 transition-all text-center font-mono text-sm font-black text-white" 
                        onChange={e => {
                          let v = e.target.value.replace(/\D/g, '');
                          if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2,4);
                          setForm({...form, expiry: v});
                        }} 
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 ml-1 tracking-widest">Code Secret (CVV)</label>
                      <input required type="password" placeholder="***" maxLength={4} className="w-full bg-black/50 border border-white/5 p-5 rounded-2xl outline-none focus:border-red-600 transition-all text-center font-mono text-sm font-black text-white" onChange={e => setForm({...form, cvv: e.target.value})} />
                    </div>
                  </div>

                  <div className="pt-8">
                    <button disabled={processing} className="w-full bg-red-600 group relative overflow-hidden py-6 rounded-[1.5rem] font-black uppercase tracking-[0.3em] text-[11px] hover:bg-red-700 active:scale-[0.97] transition-all disabled:opacity-50 shadow-2xl shadow-red-600/20">
                      <div className="relative z-10 flex items-center justify-center gap-4">
                        {processing ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <>PROCÉDER AU PAIEMENT <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform duration-300"/></>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </button>
                  </div>
                </form>

                {errorMsg && (
                  <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-500 text-[10px] font-black uppercase animate-shake">
                    <AlertTriangle size={20} className="flex-shrink-0"/>
                    <span className="leading-tight">{errorMsg}</span>
                  </div>
                )}

                {/* Trust Badges */}
                <div className="flex flex-col items-center gap-8 pt-10 border-t border-white/5 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
                  <div className="flex items-center gap-10">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" className="h-3 invert" alt="visa" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-6 invert" alt="mastercard" />
                    <div className="h-6 w-px bg-white/20"></div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-white"/>
                      <span className="text-[8px] font-black uppercase tracking-[0.4em]">PCI Compliant</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        Propulsé par Hatex Card Service S.A <ExternalLink size={8}/>
                     </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Estil Adisyonèl */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(220,38,38,0.2); }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}} />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CheckoutContent />
    </Suspense>
  );
}