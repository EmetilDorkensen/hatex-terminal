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
  ExternalLink, CreditCardIcon, ShieldAlert,
  Zap, Calendar, Fingerprint, EyeOff
} from 'lucide-react';

/**
 * @interface ProductItem
 * Estrikti done pou chak atik nan panyen an
 */
interface ProductItem {
  name?: string;
  product_name?: string;
  img?: string;
  image?: string;
  qty?: number;
  quantity?: number;
  price: number;
  variant?: string;
  description?: string;
}

// ==========================================
// 1. COMPONENTS LOADING (PRE-RENDER)
// ==========================================
const LoadingScreen = () => (
  <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center space-y-8 relative overflow-hidden">
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/10 blur-[120px] rounded-full"></div>
    </div>
    
    <div className="relative">
      <div className="w-20 h-20 border-2 border-red-600/10 border-t-red-600 rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Lock size={20} className="text-red-600 animate-pulse" />
      </div>
    </div>
    
    <div className="flex flex-col items-center text-center space-y-2 z-10">
      <p className="text-white font-black uppercase tracking-[0.5em] text-[12px] animate-pulse">Initialisation</p>
      <div className="flex items-center gap-2">
         <span className="h-px w-8 bg-zinc-800"></span>
         <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Hatex Secure Protocol v6.5</p>
         <span className="h-px w-8 bg-zinc-800"></span>
      </div>
    </div>

    <div className="absolute bottom-10 left-0 right-0 flex justify-center opacity-20">
       <div className="text-[10px] font-mono text-zinc-400">ENCRYPTING CONNECTION... AES-256</div>
    </div>
  </div>
);

// ==========================================
// 2. MAIN CHECKOUT CONTENT
// ==========================================
function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // --- States ---
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'invoice' | 'sdk'>('sdk');
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSecureOverlay, setShowSecureOverlay] = useState(false);
  
  // --- Data States ---
  const [amount, setAmount] = useState<number>(0);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState('');
  const [businessName, setBusinessName] = useState('Hatex Merchant');
  const [kycStatus, setKycStatus] = useState<string>('');
  const [invoice, setInvoice] = useState<any>(null);

  // --- Form States ---
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    card: '',
    expiry: '',
    cvv: ''
  });

  // ==========================================
  // 3. LOGIK DEKODAJ DONE (SDK/TOKEN)
  // ==========================================
  const sdkData = useMemo(() => {
    const token = searchParams.get('token');
    let decoded: any = {};
    
    if (token) {
      try {
        decoded = JSON.parse(decodeURIComponent(escape(atob(token))));
      } catch (e) {
        console.error("SDK_TOKEN_ERROR: Data integrity check failed.");
      }
    }

    // Ekstraksyon Pwodwi avèk UI pwofondè
    let productList: ProductItem[] = [];
    if (decoded.order_details?.items) {
      productList = decoded.order_details.items;
    } else if (Array.isArray(decoded.cart)) {
      productList = decoded.cart;
    } else if (decoded.product_name || decoded.product) {
      productList = [{
        name: decoded.product_name || decoded.product,
        img: decoded.image || decoded.img,
        qty: decoded.quantity || 1,
        price: decoded.price || decoded.amount || 0,
        variant: decoded.variant
      }];
    }

    const nameString = productList.map(p => `${p.qty || 1}x ${p.name || p.product_name}`).join(', ');

    return {
      shop_name: decoded.shop_name || searchParams.get('shop_name') || 'Hatex Merchant',
      products: productList,
      full_product_names: nameString || 'Achat Boutique',
      subtotal: decoded.order_details?.subtotal || 0,
      shipping_fee: decoded.order_details?.shipping_fee || 0,
      shipping_zone: decoded.order_details?.shipping_zone || 'Lokal',
      customer: {
        name: decoded.customer?.full_name || decoded.customer?.n || searchParams.get('customer_name') || 'Kliyan',
        email: decoded.customer?.email || decoded.customer_email || 'client@hatex.com',
        phone: decoded.customer?.phone || decoded.customer?.p || 'Non spécifié',
        address: decoded.customer?.address || decoded.customer?.a || 'Adresse non spécifiée'
      },
      terminal: decoded.terminal || searchParams.get('terminal'),
      total: decoded.amount || Number(searchParams.get('amount')) || 0,
      platform: "Hatex Enterprise SDK v6.5"
    };
  }, [searchParams]);

  // ==========================================
  // 4. INITIALISATION DATA (USE EFFECT)
  // ==========================================
  useEffect(() => {
    const fetchCheckoutContext = async () => {
      const invId = searchParams.get('invoice_id');
      const terminalId = sdkData.terminal;

      try {
        if (invId) {
          setCheckoutType('invoice');
          const { data: inv, error } = await supabase.from('invoices').select('*').eq('id', invId).single();
          if (error || !inv) throw new Error("Accès refusé : Facture introuvable ou expirée.");
          
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
        } else if (terminalId) {
          setCheckoutType('sdk');
          setReceiverId(terminalId);
          setAmount(sdkData.total);
          setOrderId(searchParams.get('order_id') || `HTX-${Math.random().toString(36).slice(2, 9).toUpperCase()}`);
          
          const { data: prof } = await supabase.from('profiles').select('business_name, kyc_status').eq('id', terminalId).single();
          if (prof) {
            setBusinessName(prof.business_name || 'Hatex Merchant');
            setKycStatus(prof.kyc_status);
          }
        } else {
          throw new Error("Erreur 403: Identifiant de terminal manquant.");
        }
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setTimeout(() => setLoading(false), 800);
      }
    };

    fetchCheckoutContext();
  }, [searchParams, supabase, sdkData]);

  // ==========================================
  // 5. HANDLING PAIEMENT (RPC SECURE)
  // ==========================================
  const processSecurePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setErrorMsg('');
    setShowSecureOverlay(true);

    try {
      if (!receiverId || amount <= 0) throw new Error("Vérification échouée: Montant invalide.");

      const payload = {
        p_terminal_id: receiverId,
        p_card_number: form.card.replace(/\s/g, ''),
        p_card_cvv: form.cvv,
        p_card_expiry: form.expiry,
        p_amount: amount,
        p_order_id: orderId,
        p_customer_name: form.firstName + ' ' + form.lastName,
        p_platform: checkoutType === 'invoice' ? `Invoice: ${businessName}` : sdkData.platform,
        p_metadata: {
          ...sdkData,
          browser: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          processed_at: new Date().toISOString()
        }
      };

      const { data, error: rpcError } = await supabase.rpc('process_secure_payment', payload);

      if (rpcError) throw rpcError;

      if (data.success) {
        // Mizajou estati
        if (checkoutType === 'invoice') {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice.id);
        } else if (data.transaction_id) {
          await supabase.from('transactions').update({
            customer_name: sdkData.customer.name,
            customer_email: sdkData.customer.email,
            customer_phone: sdkData.customer.phone,
            customer_address: `${sdkData.shipping_zone} | ${sdkData.customer.address}`,
            product_name: sdkData.full_product_names,
            type: 'SALE'
          }).eq('id', data.transaction_id);
        }

        // Deklanche notifikasyon API
        fetch('/api/notify-merchant', {
          method: 'POST',
          body: JSON.stringify({ orderId, merchant: receiverId, status: 'SUCCESS' })
        }).catch(() => null);

        setAlreadyPaid(true);
      } else {
        throw new Error(data.message || "Transaction déclinée par l'émetteur.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Une erreur technique est survenue.");
      setShowSecureOverlay(false);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 selection:bg-red-600/30 font-sans antialiased overflow-x-hidden">
      
      {/* --------------------------------------------------------- */}
      {/* MAIN WRAPPER */}
      {/* --------------------------------------------------------- */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen relative">
        
        {/* ========================================================= */}
        {/* SEKSYON GÒCH: LIS PWODWI & DETAY (UI MODÈN) */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 p-6 lg:p-16 bg-white/[0.01] border-r border-white/5 flex flex-col h-full relative z-10 overflow-y-auto custom-scrollbar">
          
          {/* Business Identity */}
          <div className="flex items-center gap-5 mb-14 animate-in fade-in slide-in-from-left-4 duration-700">
            <div className="relative group">
              <div className="absolute inset-0 bg-red-600 blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-800 rounded-3xl flex items-center justify-center shadow-2xl relative transform -rotate-2 group-hover:rotate-0 transition-all">
                <Building2 size={30} className="text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter leading-none mb-2 italic">
                {businessName}
              </h1>
              <div className="flex items-center gap-3">
                {kycStatus === 'approved' ? (
                  <span className="flex items-center gap-1.5 text-[9px] bg-green-500/10 text-green-400 px-3 py-1 rounded-full border border-green-500/20 font-black uppercase tracking-widest">
                    <CheckCircle2 size={12}/> Marchand Vérifié
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[9px] bg-zinc-800 text-zinc-500 px-3 py-1 rounded-full font-black uppercase tracking-widest">
                    <Fingerprint size={12}/> Hatex Security
                  </span>
                )}
                <span className="text-[10px] text-zinc-700 font-mono tracking-tighter">#{orderId}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-12">
            {checkoutType === 'sdk' ? (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
                
                {/* --- LIS PWODWI YO (DESIGN RE-TRAVAILLÉ) --- */}
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <p className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.3em] flex items-center gap-3">
                      <ShoppingCart size={14} className="text-red-600"/> Votre Panier
                    </p>
                    <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-[10px] font-bold text-zinc-400">
                      {sdkData.products.length} {sdkData.products.length > 1 ? 'Articles' : 'Article'}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {sdkData.products.map((item, idx) => (
                      <div key={idx} className="group relative">
                        <div className="absolute -inset-2 bg-gradient-to-r from-red-600/0 to-red-600/5 rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-all"></div>
                        <div className="relative bg-zinc-900/40 border border-white/5 p-5 rounded-[2rem] flex items-center gap-5 backdrop-blur-sm">
                          
                          {/* Photo Pwodwi */}
                          <div className="w-24 h-24 bg-black rounded-2xl border border-white/10 overflow-hidden flex-shrink-0 shadow-2xl relative">
                            {item.img || item.image ? (
                              <img 
                                src={item.img || item.image} 
                                alt={item.name} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                <Package size={32} className="text-zinc-800" />
                              </div>
                            )}
                            <div className="absolute top-1 right-1 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-black text-white border border-white/10">
                              x{item.qty || item.quantity || 1}
                            </div>
                          </div>

                          {/* Non ak Detay */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-black text-[14px] uppercase text-white tracking-tight leading-tight group-hover:text-red-500 transition-colors truncate mb-2">
                              {item.name || item.product_name || 'Produit'}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                               {item.variant && (
                                 <span className="text-[9px] bg-red-600/10 text-red-500 px-2.5 py-1 rounded-md border border-red-600/20 font-black uppercase italic">
                                   {item.variant}
                                 </span>
                               )}
                               <span className="text-[9px] bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-md font-bold uppercase tracking-tighter">
                                 Unité: {Number(item.price).toLocaleString()} HTG
                               </span>
                            </div>
                          </div>

                          {/* Pri Total Atik */}
                          <div className="text-right flex flex-col items-end">
                            <p className="text-lg font-black text-white italic tracking-tighter">
                              {(Number(item.price) * (item.qty || item.quantity || 1)).toLocaleString()}
                            </p>
                            <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Gourdes</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* --- SEKSYON LIVREZON --- */}
                <div className="bg-gradient-to-br from-zinc-900/50 to-black border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="px-8 py-5 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                        <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-3">
                            <Truck size={16} className="text-red-600"/> Détails d'expédition
                        </p>
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                           <span className="text-[10px] font-black text-white uppercase italic tracking-widest">{sdkData.shipping_zone}</span>
                        </div>
                    </div>
                    
                    <div className="p-8 space-y-8">
                        <div className="flex items-start gap-5 group/item">
                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-500 group-hover/item:bg-red-600 group-hover/item:text-white transition-all duration-500">
                                <User size={22}/>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase text-zinc-600 mb-1 tracking-[0.2em]">Destinataire Principal</p>
                                <p className="text-base font-bold text-white group-hover/item:translate-x-1 transition-transform">{sdkData.customer.name}</p>
                                <p className="text-xs text-zinc-500 font-medium mt-1">{sdkData.customer.phone}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-5 group/item">
                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-500 group-hover/item:bg-red-600 group-hover/item:text-white transition-all duration-500">
                                <MapPin size={22}/>
                            </div>
                            <div className="flex-1">
                                <p className="text-[9px] font-black uppercase text-zinc-600 mb-1 tracking-[0.2em]">Adresse de Livraison</p>
                                <p className="text-[14px] font-medium text-zinc-300 leading-relaxed italic opacity-80 group-hover/item:opacity-100 transition-opacity">
                                    "{sdkData.customer.address}"
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

              </div>
            ) : (
              /* --- INVOICE VIEW (ENTAK) --- */
              <div className="space-y-8 animate-in fade-in duration-700">
                <div className="bg-zinc-900/40 border border-white/5 rounded-[3rem] p-10 space-y-10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <FileText size={120} />
                  </div>
                  
                  <div className="flex items-center gap-4 border-b border-white/5 pb-8">
                    <div className="w-14 h-14 bg-red-600/10 rounded-2xl flex items-center justify-center text-red-600">
                      <FileText size={28}/>
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter">Facture Client</h3>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Identifiant Unique: {orderId}</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="flex items-start gap-6">
                      <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400">
                        <Mail size={22}/>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-600 font-black uppercase block mb-1 tracking-[0.2em]">Email Destinataire</span>
                        <span className="text-lg font-bold text-white block underline decoration-red-600/40 underline-offset-8">
                          {invoice?.client_email}
                        </span>
                      </div>
                    </div>

                    <div className="bg-red-600/5 border border-red-600/10 p-6 rounded-3xl flex gap-5">
                      <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-red-600/20">
                        <ShieldAlert size={20}/>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[11px] font-black text-red-500 uppercase tracking-widest">Sécurité Critique</p>
                         <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">
                           Ce lien de paiement est à usage unique. Ne partagez jamais vos informations de carte Hatex avec un tiers.
                         </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* TOTAL STICKY FOOTER */}
          <div className="mt-16 pt-10 border-t border-white/5 sticky bottom-0 bg-[#050505] z-30 pb-10">
              <div className="space-y-6">
                {checkoutType === 'sdk' && (
                  <div className="flex flex-col gap-2 px-2">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                      <span>Sous-total HTG</span>
                      <span className="text-zinc-400">{(sdkData.subtotal || amount).toLocaleString()}</span>
                    </div>
                    {Number(sdkData.shipping_fee) > 0 && (
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                        <span>Frais de livraison</span>
                        <span className="text-red-500">+{sdkData.shipping_fee.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex items-end justify-between px-2">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-red-600 tracking-[0.4em] mb-4 flex items-center gap-2">
                      <Zap size={12} fill="currentColor"/> Montant Total
                    </p>
                    <div className="flex items-baseline gap-4">
                      <span className="text-7xl lg:text-8xl font-black tracking-tighter italic text-white drop-shadow-2xl">
                        {amount.toLocaleString()}
                      </span>
                      <span className="text-2xl font-black text-red-600 italic tracking-widest uppercase">HTG</span>
                    </div>
                  </div>
                  <div className="text-right pb-4 hidden sm:block">
                     <div className="inline-flex flex-col items-end gap-2">
                        <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-3">
                           <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                           <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest whitespace-nowrap">Encryption Active</span>
                        </div>
                        <p className="text-[9px] text-zinc-800 font-mono">NODE_TX: {Math.random().toString(16).slice(2, 10).toUpperCase()}</p>
                     </div>
                  </div>
                </div>
              </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SEKSYON DWAT: PEMAN (CARD GATEWAY) */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 bg-[#08090f] p-6 lg:p-24 flex flex-col justify-center relative overflow-hidden">
          
          {/* Background FX */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-red-600/10 blur-[180px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-40"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/5 blur-[150px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none opacity-20"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none"></div>

          <div className="relative z-10 max-w-lg mx-auto w-full">
            
            {alreadyPaid ? (
              /* SUCCESS VIEW */
              <div className="text-center space-y-12 animate-in zoom-in-95 duration-1000">
                <div className="relative inline-block group">
                    <div className="absolute inset-0 bg-green-500 blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity animate-pulse"></div>
                    <div className="w-32 h-32 bg-green-500 rounded-[3rem] mx-auto flex items-center justify-center shadow-2xl rotate-12 transition-transform hover:rotate-0 duration-700 relative">
                      <CheckCircle2 size={64} className="text-black stroke-[3px]" />
                    </div>
                </div>
                
                <div className="space-y-4">
                  <h2 className="text-6xl font-black uppercase italic tracking-tighter text-white">Approuvé !</h2>
                  <p className="text-zinc-500 text-sm font-medium max-w-[320px] mx-auto leading-relaxed">
                    Votre transaction a été validée avec succès par le réseau Hatex. Votre reçu numérique est prêt.
                  </p>
                </div>

                <div className="flex flex-col gap-4 pt-8">
                  <button onClick={() => window.print()} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-[12px] tracking-[0.2em] flex items-center justify-center gap-4 hover:bg-zinc-200 transition-all active:scale-95 shadow-xl shadow-white/5">
                    <Download size={20}/> Télécharger le Reçu PDF
                  </button>
                  <button 
                    onClick={() => checkoutType === 'sdk' ? window.history.back() : router.push('/')} 
                    className="w-full bg-white/5 border border-white/10 py-6 rounded-3xl font-black uppercase text-[11px] tracking-[0.4em] text-zinc-500 hover:bg-white/10 hover:text-white transition-all"
                  >
                    Retourner à la boutique
                  </button>
                </div>
                
                <div className="pt-10 flex justify-center items-center gap-6 opacity-40">
                   <div className="h-px w-12 bg-zinc-800"></div>
                   <p className="text-[10px] font-mono">AUTH_CODE: 200_OK_HTX</p>
                   <div className="h-px w-12 bg-zinc-800"></div>
                </div>
              </div>
            ) : (
              /* PAYMENT FORM VIEW */
              <div className="space-y-14 animate-in fade-in slide-in-from-right-8 duration-1000">
                
                {/* Header Gateway */}
                <div className="flex items-end justify-between border-b border-white/5 pb-10">
                   <div className="space-y-2">
                      <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white flex items-center gap-4">
                        Paiement <CreditCardIcon className="text-red-600" size={32}/>
                      </h2>
                      <div className="flex items-center gap-2">
                         <span className="w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                         <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-[0.3em]">Hatex Gateway v6.5 <span className="text-zinc-800 ml-2">Secure Line</span></p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-2xl hover:border-red-600/50 transition-colors cursor-help"><Globe size={18} className="text-zinc-600"/></div>
                      <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-2xl hover:border-red-600/50 transition-colors cursor-help"><Lock size={18} className="text-zinc-600"/></div>
                   </div>
                </div>

                <form onSubmit={processSecurePayment} className="space-y-8">
                  
                  {/* Kat Info */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase text-zinc-500 ml-2 tracking-widest flex items-center gap-2">
                         <User size={12}/> Prénom
                      </label>
                      <input 
                        required 
                        placeholder="Ex: Jean" 
                        className="w-full bg-black/40 border border-white/5 p-5 rounded-3xl outline-none focus:border-red-600/50 focus:bg-black transition-all text-sm font-bold text-white placeholder:text-zinc-800 focus:ring-4 focus:ring-red-600/5" 
                        onChange={e => setForm({...form, firstName: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase text-zinc-500 ml-2 tracking-widest flex items-center gap-2">
                        <User size={12}/> Nom
                      </label>
                      <input 
                        required 
                        placeholder="Ex: Dupont" 
                        className="w-full bg-black/40 border border-white/5 p-5 rounded-3xl outline-none focus:border-red-600/50 focus:bg-black transition-all text-sm font-bold text-white placeholder:text-zinc-800 focus:ring-4 focus:ring-red-600/5" 
                        onChange={e => setForm({...form, lastName: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[11px] font-black uppercase text-zinc-500 ml-2 tracking-widest flex justify-between">
                      <span>Numéro de la Carte Hatex</span>
                      <span className="text-zinc-800 font-mono text-[9px]">DEBIT / CREDIT</span>
                    </label>
                    <div className="relative group">
                      <input 
                        required 
                        placeholder="0000 0000 0000 0000" 
                        className="w-full bg-black/40 border border-white/5 p-6 rounded-3xl outline-none focus:border-red-600 focus:bg-black transition-all font-mono tracking-[0.4em] text-lg text-white placeholder:text-zinc-900" 
                        onChange={e => {
                          let v = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                          setForm({...form, card: v});
                        }} 
                        maxLength={19} 
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
                         <div className="w-px h-6 bg-white/10"></div>
                         <CreditCard className="text-zinc-800 group-focus-within:text-red-600 transition-colors" size={24}/>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase text-zinc-500 ml-2 tracking-widest flex items-center gap-2">
                        <Calendar size={12}/> Expiration
                      </label>
                      <input 
                        required 
                        placeholder="MM / YY" 
                        maxLength={5} 
                        className="w-full bg-black/40 border border-white/5 p-6 rounded-3xl outline-none focus:border-red-600 transition-all text-center font-mono text-base font-black text-white" 
                        onChange={e => {
                          let v = e.target.value.replace(/\D/g, '');
                          if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2,4);
                          setForm({...form, expiry: v});
                        }} 
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase text-zinc-500 ml-2 tracking-widest flex items-center gap-2">
                        <EyeOff size={12}/> Code CVV
                      </label>
                      <input 
                        required 
                        type="password" 
                        placeholder="***" 
                        maxLength={4} 
                        className="w-full bg-black/40 border border-white/5 p-6 rounded-3xl outline-none focus:border-red-600 transition-all text-center font-mono text-base font-black text-white" 
                        onChange={e => setForm({...form, cvv: e.target.value})} 
                      />
                    </div>
                  </div>

                  {/* Bouton Aksyon */}
                  <div className="pt-10">
                    <button 
                      disabled={processing} 
                      className="w-full bg-red-600 group relative overflow-hidden py-7 rounded-[2rem] font-black uppercase tracking-[0.4em] text-[13px] hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-2xl shadow-red-600/20"
                    >
                      <div className="relative z-10 flex items-center justify-center gap-5 italic">
                        {processing ? (
                          <div className="flex items-center gap-3">
                             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                             <span>Traitement sécurisé...</span>
                          </div>
                        ) : (
                          <>CONFIRMER LE PAIEMENT <ArrowRight size={20} className="group-hover:translate-x-3 transition-transform duration-500"/></>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1.5s]"></div>
                    </button>
                    <p className="text-center mt-6 text-[9px] text-zinc-700 font-bold uppercase tracking-[0.2em]">En cliquant, vous acceptez les conditions d'utilisation de Hatex S.A</p>
                  </div>
                </form>

                {errorMsg && (
                  <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-[2rem] flex items-center gap-5 text-red-500 text-[11px] font-black uppercase animate-shake shadow-2xl shadow-red-500/5">
                    <div className="w-10 h-10 bg-red-500 rounded-2xl flex items-center justify-center text-white shrink-0">
                       <AlertTriangle size={20}/>
                    </div>
                    <span className="leading-tight">{errorMsg}</span>
                  </div>
                )}

                {/* Secure Badge Section */}
                <div className="pt-14 border-t border-white/5">
                  <div className="flex flex-col items-center gap-10 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-1000">
                    <div className="flex items-center gap-12">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" className="h-4 invert" alt="visa" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-8 invert" alt="mastercard" />
                      <div className="h-8 w-px bg-white/10"></div>
                      <div className="flex items-center gap-3">
                        <ShieldCheck size={20} className="text-white"/>
                        <div className="flex flex-col">
                           <span className="text-[9px] font-black uppercase tracking-widest leading-none">PCI-DSS</span>
                           <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-tighter">Certified Level 1</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                       <div className="flex items-center gap-2 text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">
                          <Zap size={10} className="text-red-600"/> Powered by Hatex Enterprise S.A
                       </div>
                       <p className="text-[8px] text-zinc-800 font-mono">Gateway Protocol: v6.5.0-STABLE | Region: Haiti (HT)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* --------------------------------------------------------- */}
      {/* GLOBAL STYLES & ANIMATIONS */}
      {/* --------------------------------------------------------- */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,700;0,800;1,400;1,800&display=swap');
        
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #050505; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(220,38,38,0.3); }
        
        @keyframes shake { 
          0%, 100% { transform: translateX(0); } 
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); } 
          20%, 40%, 60%, 80% { transform: translateX(4px); } 
        }
        .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        
        input { transition: all 0.3s ease; }
        input::placeholder { color: #1a1a1a; }
        
        @media print {
          .lg:col-span-7 { display: none; }
          .lg:col-span-5 { width: 100%; border: none; }
        }
      `}} />

      {/* SECURE OVERLAY LOGIK */}
      {showSecureOverlay && !alreadyPaid && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
           <div className="w-24 h-24 relative mb-8">
              <div className="absolute inset-0 border-4 border-red-600/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-red-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <ShieldCheck size={32} className="text-red-600" />
              </div>
           </div>
           <h3 className="text-xl font-black uppercase tracking-[0.3em] mb-2 text-white">Vérification Hatex</h3>
           <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest animate-pulse">Communication avec les serveurs bancaires...</p>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 6. EXPORT WRAPPER (SUSPENSE)
// ==========================================
export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CheckoutContent />
    </Suspense>
  );
}

/**
 * FIN DU CODE - Hatex Secure Gateway v6.5
 * Total Lignes Estimé: ~600+ avec structures et styles
 */