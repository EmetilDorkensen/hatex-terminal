"use client";

import React, { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Lock, CreditCard, CheckCircle2, 
  MapPin, Phone, FileText, Download,
  AlertTriangle, Building2, Package,
  ArrowRight, ShieldCheck, ShoppingCart, User,
  Globe, Info, Mail, Truck, Hash, 
  ExternalLink, CreditCardIcon, ShieldAlert,
  Zap, Calendar, Fingerprint, EyeOff,
  Activity, Shield, Smartphone, Server,
  ArrowLeftRight, RefreshCcw, CreditCard as CardIcon
} from 'lucide-react';

/**
 * ============================================================
 * TYPE DEFINITIONS & INTERFACES
 * ============================================================
 */
interface ProductItem {
  name?: string;
  product_name?: string;
  img?: string;
  image?: string;
  product_image?: string;
  photo?: string;
  qty?: number;
  quantity?: number;
  price: number | string;
  variant?: string;
  size?: string;
  description?: string;
  category?: string;
  sku?: string;
}

interface CustomerData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  country?: string;
}

// ==========================================
// 1. ADVANCED LOADING SCREEN (PRE-RENDER)
// ==========================================
const LoadingScreen = () => {
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center space-y-8 relative overflow-hidden">
      {/* Background Lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-red-600/10 blur-[180px] rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
      </div>
      
      {/* Animated Hexagon/Circle Spinner */}
      <div className="relative">
        <div className="w-32 h-32 border-[3px] border-red-600/5 border-t-red-600 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 border-[1px] border-zinc-800 rounded-full animate-reverse-spin"></div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Lock size={32} className="text-red-600 animate-pulse" />
        </div>
      </div>
      
      {/* Text Logs */}
      <div className="flex flex-col items-center text-center space-y-6 z-10">
        <div className="space-y-2">
          <p className="text-white font-black uppercase tracking-[1em] text-[16px] animate-pulse">Initialisation</p>
          <div className="flex items-center justify-center gap-4">
             <span className="h-px w-16 bg-zinc-800"></span>
             <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">Hatex Secure Protocol v6.5</p>
             <span className="h-px w-16 bg-zinc-800"></span>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce"></div>
        </div>
      </div>

      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-3">
         <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-md">
            <p className="text-[9px] font-mono text-zinc-400 tracking-[0.3em]">ENCRYPTING CONNECTION... AES-256-GCM</p>
         </div>
         <div className="flex items-center gap-6 opacity-30">
            <div className="flex items-center gap-2"><Activity size={12}/> <span className="text-[8px] font-bold uppercase">SSL Active</span></div>
            <div className="flex items-center gap-2"><Shield size={12}/> <span className="text-[8px] font-bold uppercase">Hatex Guard</span></div>
            <div className="flex items-center gap-2"><Server size={12}/> <span className="text-[8px] font-bold uppercase">Core-01</span></div>
         </div>
      </div>
    </div>
  );
};

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

  // ------------------------------------------
  // CORE STATES
  // ------------------------------------------
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'invoice' | 'sdk'>('sdk');
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSecureOverlay, setShowSecureOverlay] = useState(false);
  
  // ------------------------------------------
  // DATA STATES
  // ------------------------------------------
  const [amount, setAmount] = useState<number>(0);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState('');
  const [businessName, setBusinessName] = useState('Hatex Merchant');
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<string>('');
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<ProductItem[]>([]);

  // ------------------------------------------
  // FORM STATES
  // ------------------------------------------
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    card: '',
    expiry: '',
    cvv: ''
  });

  const [paymentStep, setPaymentStep] = useState(1);

  // ==========================================
  // 3. SMART SCAN LOGIC (THE HEART)
  // ==========================================
  const sdkData = useMemo(() => {
    const token = searchParams.get('token');
    let decoded: any = {};
    
    if (token) {
      try {
        // Double decoding for legacy support
        decoded = JSON.parse(decodeURIComponent(escape(atob(token))));
      } catch (e) {
        console.error("TOKEN_DECODE_FATAL: Security handshake failed.");
      }
    }

    // Comprehensive item extractor
    let productList: ProductItem[] = [];
    let rawItems: any[] = [];

    if (decoded.order_details?.items) {
      rawItems = decoded.order_details.items;
    } else if (Array.isArray(decoded.cart)) {
      rawItems = decoded.cart;
    } else if (decoded.product_name || decoded.product) {
      rawItems = [decoded];
    } else if (searchParams.get('p_name')) {
      rawItems = [{
        name: searchParams.get('p_name'),
        price: searchParams.get('amount'),
        img: searchParams.get('p_img')
      }];
    }

    // Advanced Attribute Mapping (Smart Scan)
    productList = rawItems.map((p: any) => ({
      name: p.name || p.product_name || p.title || 'Produit Sans Nom',
      img: p.img || p.image || p.product_image || p.photo || p.thumbnail || p.picture_url || null,
      qty: parseInt(p.qty || p.quantity || 1),
      price: parseFloat(p.price || p.amount || 0),
      variant: p.variant || p.size || p.color || 'Standard',
      description: p.description || p.desc || '',
      sku: p.sku || p.id || ''
    }));

    const nameString = productList.map(p => `${p.qty}x ${p.name}`).join(', ');

    return {
      shop_name: decoded.shop_name || searchParams.get('shop_name') || 'Hatex Enterprise',
      products: productList,
      full_product_names: nameString || 'Achat Boutique',
      subtotal: decoded.order_details?.subtotal || 0,
      shipping_fee: decoded.order_details?.shipping_fee || 0,
      shipping_zone: decoded.order_details?.shipping_zone || 'Livraison Locale',
      customer: {
        name: decoded.customer?.full_name || decoded.customer?.n || searchParams.get('customer_name') || 'Kliyan Hatex',
        email: decoded.customer?.email || decoded.customer_email || 'client@hatex.com',
        phone: decoded.customer?.phone || decoded.customer?.p || 'Aucun numéro',
        address: decoded.customer?.address || decoded.customer?.a || 'Adresse non fournie'
      },
      terminal: decoded.terminal || searchParams.get('terminal'),
      total: decoded.amount || Number(searchParams.get('amount')) || 0,
      platform: "Hatex Enterprise SDK v6.5",
      currency: decoded.currency || "HTG"
    };
  }, [searchParams]);

  // ==========================================
  // 4. DATA SYNCHRONIZATION (Supabase)
  // ==========================================
  useEffect(() => {
    const initializeCheckout = async () => {
      const invId = searchParams.get('invoice_id');
      const terminalId = sdkData.terminal;

      try {
        if (invId) {
          setCheckoutType('invoice');
          const { data: inv, error } = await supabase.from('invoices').select('*').eq('id', invId).single();
          
          if (error || !inv) throw new Error("Accès refusé : Identifiant de facture invalide.");
          
          setInvoice(inv);
          setReceiverId(inv.owner_id);
          setAmount(Number(inv.amount));
          setOrderId(`INV-${inv.id.slice(0, 8).toUpperCase()}`);
          if (inv.status === 'paid') setAlreadyPaid(true);

          const { data: profile } = await supabase.from('profiles').select('*').eq('id', inv.owner_id).single();
          if (profile) {
            setBusinessName(profile.business_name || 'Hatex Merchant');
            setKycStatus(profile.kyc_status);
            setBusinessLogo(profile.avatar_url);
          }
        } else if (terminalId) {
          setCheckoutType('sdk');
          setReceiverId(terminalId);
          setAmount(sdkData.total);
          setItems(sdkData.products);
          setOrderId(searchParams.get('order_id') || `HTX-${Math.random().toString(36).slice(2, 10).toUpperCase()}`);
          
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', terminalId).single();
          if (profile) {
            setBusinessName(profile.business_name || 'Hatex Merchant');
            setKycStatus(profile.kyc_status);
            setBusinessLogo(profile.avatar_url);
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message);
        console.error("INIT_ERROR:", err);
      } finally {
        // Simulating heavy decryption for UX
        setTimeout(() => setLoading(false), 2000);
      }
    };

    initializeCheckout();
  }, [searchParams, supabase, sdkData]);

  // ==========================================
  // 5. TRANSACTION HANDLER (RPC SECURE)
  // ==========================================
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setErrorMsg('');
    setShowSecureOverlay(true);

    try {
      if (!receiverId || amount <= 0) throw new Error("Données de transaction corrompues.");

      // Execution nan Database
      const { data, error: rpcError } = await supabase.rpc('process_secure_payment', {
        p_terminal_id: receiverId,
        p_card_number: form.card.replace(/\s/g, ''),
        p_card_cvv: form.cvv,
        p_card_expiry: form.expiry,
        p_amount: amount,
        p_order_id: orderId,
        p_customer_name: form.firstName + ' ' + form.lastName,
        p_platform: checkoutType === 'invoice' ? `Direct Invoice: ${businessName}` : sdkData.platform,
        p_metadata: {
          items: items,
          customer_info: sdkData.customer,
          security_hash: btoa(orderId),
          timestamp: new Date().toISOString(),
          environment: "production_v6"
        }
      });

      if (rpcError) throw rpcError;

      if (data.success) {
        if (checkoutType === 'invoice' && invoice) {
          await supabase.from('invoices').update({ 
            status: 'paid',
            paid_at: new Date().toISOString()
          }).eq('id', invoice.id);
        }
        
        // Success Delay for psychological validation
        setTimeout(() => {
          setAlreadyPaid(true);
          setShowSecureOverlay(false);
        }, 1500);
      } else {
        throw new Error(data.message || "La transaction a été refusée par la banque.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur de communication avec le serveur.");
      setShowSecureOverlay(false);
    } finally {
      setProcessing(false);
    }
  };

  // ------------------------------------------
  // UI HELPERS
  // ------------------------------------------
  const formatCard = (value: string) => {
    return value.replace(/\W/gi, '').replace(/(.{4})/g, '$1 ').trim();
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 selection:bg-red-600/30 font-sans antialiased overflow-x-hidden">
      
      {/* Dynamic Background Noise/Gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[70%] h-[70%] bg-red-600/5 blur-[150px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-5%] left-[-5%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full opacity-20"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/asfalt-dark.png')] opacity-[0.03]"></div>
      </div>

      <div className="max-w-[1700px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen relative z-10 shadow-2xl">
        
        {/* ==========================================
            LEFT PANEL: INVENTORY & SHOP INFO
        ========================================== */}
        <div className="lg:col-span-5 p-6 lg:p-20 bg-white/[0.01] border-r border-white/5 flex flex-col h-full overflow-y-auto custom-scrollbar relative">
          
          {/* Brand Header */}
          <div className="flex items-center gap-8 mb-20 animate-in fade-in slide-in-from-left-8 duration-1000">
            <div className="relative group">
              <div className="absolute inset-0 bg-red-600 blur-2xl opacity-10 group-hover:opacity-30 transition-opacity duration-700"></div>
              <div className="w-24 h-24 bg-gradient-to-br from-red-600 to-red-950 rounded-[2.5rem] flex items-center justify-center shadow-3xl relative transform -rotate-3 group-hover:rotate-0 transition-all duration-700 border border-white/10">
                {businessLogo ? (
                  <img src={businessLogo} alt="Logo" className="w-full h-full object-cover rounded-[2.5rem]" />
                ) : (
                  <Building2 size={40} className="text-white" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-black uppercase tracking-tighter italic leading-none text-white drop-shadow-sm">
                {businessName}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                {kycStatus === 'approved' ? (
                  <span className="flex items-center gap-2 text-[10px] bg-green-500/10 text-green-400 px-4 py-1.5 rounded-full border border-green-500/20 font-black uppercase tracking-[0.2em] shadow-lg">
                    <CheckCircle2 size={12}/> Marchand Vérifié
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-[10px] bg-zinc-900/50 text-zinc-500 px-4 py-1.5 rounded-full font-black uppercase tracking-[0.2em] border border-white/5">
                    <Fingerprint size={12}/> Hatex Auth
                  </span>
                )}
                <span className="text-[10px] text-zinc-700 font-mono tracking-widest px-3">ID: {orderId}</span>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 space-y-16">
            
            {checkoutType === 'sdk' ? (
              <div className="space-y-16">
                
                {/* INVENTORY LIST (THE 800-LINE DETAIL) */}
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-white/10 pb-8">
                    <h2 className="text-[13px] font-black uppercase text-zinc-400 tracking-[0.4em] flex items-center gap-4">
                      <ShoppingCart size={18} className="text-red-600"/> Panier d'achat
                    </h2>
                    <div className="flex items-center gap-4">
                      <span className="px-4 py-1 bg-white/5 rounded-full text-[10px] font-black text-zinc-500 border border-white/5">
                        {items.length} PRODUITS
                      </span>
                    </div>
                  </div>

                  <div className="space-y-6 max-h-[550px] overflow-y-auto pr-4 custom-scrollbar">
                    {items.map((item, idx) => (
                      <div key={idx} className="bg-white group rounded-[3rem] p-6 flex items-center gap-8 shadow-2xl transform transition-all duration-500 hover:scale-[1.02] hover:bg-zinc-50 border border-transparent hover:border-zinc-200">
                        
                        {/* Image Container */}
                        <div className="w-28 h-28 bg-zinc-100 rounded-[2rem] overflow-hidden flex-shrink-0 flex items-center justify-center relative shadow-inner">
                          {item.img ? (
                            <img 
                              src={item.img} 
                              alt={item.name} 
                              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-125" 
                            />
                          ) : (
                            <Package size={38} className="text-zinc-300" />
                          )}
                          <div className="absolute bottom-0 right-0 bg-black text-white text-[10px] font-black px-3 py-1.5 rounded-tl-2xl shadow-xl">
                            x{item.qty}
                          </div>
                        </div>

                        {/* Product Meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-black text-[20px] text-zinc-900 leading-[1.1] truncate uppercase italic tracking-tighter">
                                {item.name}
                              </h3>
                              <p className="text-[11px] font-black text-red-600 uppercase mt-2 tracking-widest bg-red-50 inline-block px-3 py-1 rounded-lg">
                                {item.variant}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[22px] font-black text-zinc-900 tracking-tighter">
                                {Number(item.price).toLocaleString()}
                              </p>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase italic">HTG / UNITÉ</p>
                            </div>
                          </div>
                          
                          {/* Item Footer Controls (Static UI) */}
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100">
                             <div className="flex items-center gap-2">
                                <button className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-400 hover:bg-zinc-100">-</button>
                                <span className="text-sm font-black text-zinc-900 w-6 text-center">{item.qty}</span>
                                <button className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-400 hover:bg-zinc-100">+</button>
                             </div>
                             <p className="text-[11px] font-mono text-zinc-400">REF_{item.sku?.slice(0,6) || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* LOGISTICS & CUSTOMER PANEL */}
                <div className="bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded-[4rem] p-12 space-y-12 shadow-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 blur-[100px] rounded-full group-hover:bg-red-600/10 transition-colors"></div>
                    
                    <div className="flex items-center justify-between border-b border-white/5 pb-8">
                       <p className="text-[12px] font-black uppercase text-zinc-500 tracking-[0.4em] flex items-center gap-4">
                          <Truck size={20} className="text-red-600 animate-bounce"/> Détails d'expédition
                       </p>
                       <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                          <span className="text-[10px] font-black text-white uppercase italic tracking-widest">{sdkData.shipping_zone}</span>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
                       <div className="flex items-start gap-6">
                          <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-zinc-500 border border-white/10 shadow-xl group-hover:border-red-600/30 transition-colors">
                            <User size={28}/>
                          </div>
                          <div>
                             <p className="text-[10px] font-black uppercase text-zinc-600 mb-2 tracking-[0.2em]">Destinataire</p>
                             <p className="text-xl font-bold text-white tracking-tight leading-none mb-1">{sdkData.customer.name}</p>
                             <p className="text-xs text-zinc-500 font-mono italic">{sdkData.customer.email}</p>
                          </div>
                       </div>
                       <div className="flex items-start gap-6">
                          <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-zinc-500 border border-white/10 shadow-xl group-hover:border-red-600/30 transition-colors">
                            <MapPin size={28}/>
                          </div>
                          <div>
                             <p className="text-[10px] font-black uppercase text-zinc-600 mb-2 tracking-[0.2em]">Localisation</p>
                             <p className="text-[14px] font-medium text-zinc-300 italic leading-relaxed">
                                {sdkData.customer.address}
                             </p>
                          </div>
                       </div>
                    </div>

                    <div className="pt-8 border-t border-white/5 flex items-center justify-between opacity-50">
                       <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500">
                          <ShieldCheck size={14}/> Transaction 100% Cryptée
                       </div>
                       <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500">
                          <Globe size={14}/> Hatex Network
                       </div>
                    </div>
                </div>

              </div>
            ) : (
              /* ==========================================
                  INVOICE SPECIFIC VIEW
              ========================================== */
              <div className="animate-in fade-in zoom-in-95 duration-1000 h-full">
                <div className="bg-zinc-900/40 border border-white/10 rounded-[5rem] p-16 space-y-16 relative overflow-hidden h-full flex flex-col justify-center">
                  <div className="absolute -top-20 -right-20 opacity-[0.03] rotate-12 scale-150"><FileText size={400} /></div>
                  
                  <div className="relative z-10 space-y-12">
                    <div className="flex items-center gap-8 border-b border-white/10 pb-12">
                      <div className="w-20 h-20 bg-red-600/10 rounded-[2rem] flex items-center justify-center text-red-600 shadow-2xl border border-red-600/20">
                        <FileText size={40}/>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Facture Digitale</h3>
                        <p className="text-[12px] text-zinc-500 font-bold uppercase tracking-[0.4em]">HTX-GATEWAY-PRO</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-12">
                      <div className="space-y-4">
                         <label className="text-[11px] font-black text-zinc-600 uppercase tracking-[0.4em] ml-2">Email du destinataire</label>
                         <div className="text-3xl font-bold text-white bg-white/5 p-8 rounded-[2.5rem] border border-white/5 flex items-center gap-4">
                            <Mail size={24} className="text-red-600"/> 
                            <span className="truncate">{invoice?.client_email || 'client@hatex.com'}</span>
                         </div>
                      </div>

                      <div className="flex items-center gap-8">
                         <div className="flex-1 p-8 bg-zinc-950/50 rounded-[2.5rem] border border-white/5">
                            <p className="text-[10px] font-black text-zinc-600 uppercase mb-2">Émis le</p>
                            <p className="text-lg font-bold text-zinc-300">
                              {invoice?.created_at ? new Date(invoice.created_at).toLocaleDateString() : 'Date non spécifiée'}
                            </p>
                         </div>
                         <div className="flex-1 p-8 bg-zinc-950/50 rounded-[2.5rem] border border-white/5">
                            <p className="text-[10px] font-black text-zinc-600 uppercase mb-2">Statut</p>
                            <p className="text-lg font-bold text-orange-500 flex items-center gap-2 uppercase italic">
                              <Activity size={16}/> En Attente
                            </p>
                         </div>
                      </div>
                    </div>

                    <div className="p-10 bg-red-600/5 border border-red-600/10 rounded-[3rem] flex gap-8 items-start">
                      <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xl border-4 border-black/20">
                        <ShieldAlert size={28}/>
                      </div>
                      <div className="space-y-3">
                         <p className="text-[14px] font-black text-red-500 uppercase tracking-widest">Avis de Confidentialité</p>
                         <p className="text-[14px] text-zinc-400 font-medium leading-relaxed italic">
                           Ce lien de paiement est généré exclusivement pour {invoice?.client_email}. Toute tentative de fraude entraînera un blocage automatique de l'adresse IP.
                         </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ==========================================
              STICKY PRICING FOOTER
          ========================================== */}
          <div className="mt-20 pt-16 border-t border-white/10 sticky bottom-0 bg-[#050505]/95 backdrop-blur-3xl z-40 pb-12">
              <div className="flex flex-col gap-10 px-4">
                <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-8">
                   <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                        <p className="text-[12px] font-black uppercase text-red-600 tracking-[0.6em] italic">Montant à régler</p>
                      </div>
                      <div className="flex items-baseline gap-8">
                        <span className="text-[100px] lg:text-[130px] font-black tracking-tighter italic text-white leading-none drop-shadow-[0_15px_40px_rgba(255,0,0,0.25)]">
                          {amount.toLocaleString()}
                        </span>
                        <div className="space-y-2">
                           <span className="text-4xl font-black text-red-600 italic tracking-widest uppercase block">HTG</span>
                           <span className="text-[10px] font-mono text-zinc-600 block text-right uppercase">Net Total</span>
                        </div>
                      </div>
                   </div>
                   
                   <div className="hidden xl:block">
                      <div className="bg-zinc-900/50 border border-white/10 p-8 rounded-[3rem] space-y-4 shadow-3xl min-w-[250px] transform hover:rotate-2 transition-transform">
                         <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            <span>Hash Code</span>
                            <Lock size={12}/>
                         </div>
                         <p className="text-[13px] font-mono text-zinc-300 break-all leading-tight opacity-70">
                            HTX_SIG_{Math.random().toString(36).substring(2, 15).toUpperCase()}
                         </p>
                         <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-red-600 w-1/3 animate-progress"></div>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
          </div>
        </div>

        {/* ==========================================
            RIGHT PANEL: PAYMENT GATEWAY
        ========================================== */}
        <div className="lg:col-span-7 bg-[#07080d] p-6 lg:p-24 flex flex-col justify-center relative overflow-hidden">
          
          {/* Cyber Decorations */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-600/[0.03] blur-[200px] rounded-full"></div>
          
          <div className="relative z-10 max-w-2xl mx-auto w-full">
            
            {alreadyPaid ? (
              /* ==========================================
                  SUCCESS STATE (EXTENDED)
              ========================================== */
              <div className="text-center space-y-20 animate-in zoom-in-95 duration-1000">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-green-500 blur-[100px] opacity-20 animate-pulse"></div>
                  <div className="w-48 h-48 bg-green-500 rounded-[5rem] mx-auto flex items-center justify-center shadow-[0_30px_60px_rgba(34,197,94,0.4)] rotate-12 relative border-[12px] border-black/20 transform hover:rotate-0 transition-all duration-700">
                    <CheckCircle2 size={90} className="text-black stroke-[3px]" />
                  </div>
                  <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-zinc-900 animate-bounce">
                    <Zap size={32} className="text-orange-500" fill="currentColor"/>
                  </div>
                </div>
                
                <div className="space-y-8">
                  <h2 className="text-8xl font-black uppercase italic tracking-tighter text-white">Approuvé</h2>
                  <div className="space-y-2">
                    <p className="text-zinc-400 text-xl font-medium max-w-[450px] mx-auto leading-relaxed">
                      Votre paiement de <span className="text-white font-black">{amount.toLocaleString()} HTG</span> a été traité avec succès.
                    </p>
                    <p className="text-zinc-600 font-mono text-sm">AuthID: HTX-{Math.floor(Math.random() * 9999999)}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-6 pt-12">
                  <button onClick={() => window.print()} className="flex-1 bg-white text-black py-8 rounded-[3rem] font-black uppercase text-[14px] tracking-[0.3em] flex items-center justify-center gap-5 hover:bg-zinc-200 transition-all active:scale-95 shadow-3xl">
                    <Download size={24}/> Reçu Officiel
                  </button>
                  <button onClick={() => router.push('/')} className="flex-1 bg-zinc-900 border border-white/10 py-8 rounded-[3rem] font-black uppercase text-[12px] tracking-[0.3em] text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all shadow-xl">
                    Terminer
                  </button>
                </div>
              </div>
            ) : (
              /* ==========================================
                  PAYMENT FORM (EXTENDED)
              ========================================== */
              <div className="space-y-20 animate-in fade-in slide-in-from-right-16 duration-1000">
                
                <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between border-b border-white/10 pb-16 gap-8">
                   <div className="space-y-4">
                      <div className="flex items-center gap-4 text-red-600">
                         <CardIcon size={32} className="animate-pulse"/>
                         <span className="text-[12px] font-black uppercase tracking-[0.6em]">Secure Gateway</span>
                      </div>
                      <h2 className="text-6xl font-black uppercase italic tracking-tighter text-white">Paiement</h2>
                   </div>
                   <div className="flex items-center gap-6 bg-white/5 p-4 rounded-[2rem] border border-white/5 shadow-inner">
                      <div className="flex -space-x-3">
                         {[1,2,3].map(i => <div key={i} className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-black text-zinc-500">H</div>)}
                      </div>
                      <div className="text-right">
                         <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest leading-none mb-1">Protection</p>
                         <p className="text-[11px] font-black text-zinc-400 uppercase italic">Multi-Layer</p>
                      </div>
                   </div>
                </div>

                <form onSubmit={handlePayment} className="space-y-12">
                  
                  {/* Step 1: Identity */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                    <div className="space-y-5">
                      <label className="text-[11px] font-black uppercase text-zinc-500 ml-6 tracking-[0.4em] flex items-center gap-3">
                         <User size={14} className="text-red-600"/> Prénom
                      </label>
                      <input 
                        required 
                        placeholder="Ex: Jean" 
                        className="w-full bg-black/40 border border-white/10 p-7 rounded-[2.5rem] outline-none focus:border-red-600 focus:bg-black/80 transition-all text-lg font-bold text-white placeholder:text-zinc-800 focus:ring-8 focus:ring-red-600/5" 
                        onChange={e => setForm({...form, firstName: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-5">
                      <label className="text-[11px] font-black uppercase text-zinc-500 ml-6 tracking-[0.4em] flex items-center gap-3">
                         <User size={14} className="text-red-600"/> Nom de Famille
                      </label>
                      <input 
                        required 
                        placeholder="Ex: Dupont" 
                        className="w-full bg-black/40 border border-white/10 p-7 rounded-[2.5rem] outline-none focus:border-red-600 focus:bg-black/80 transition-all text-lg font-bold text-white placeholder:text-zinc-800 focus:ring-8 focus:ring-red-600/5" 
                        onChange={e => setForm({...form, lastName: e.target.value})} 
                      />
                    </div>
                  </div>

                  {/* Step 2: Card Details */}
                  <div className="space-y-5">
                    <label className="text-[11px] font-black uppercase text-zinc-500 ml-6 tracking-[0.4em] flex justify-between items-center">
                       <span className="flex items-center gap-3"><CreditCard size={14} className="text-red-600"/> Numéro de Carte</span>
                       <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded tracking-normal font-mono">ENCRYPTED</span>
                    </label>
                    <div className="relative group">
                      <input 
                        required 
                        maxLength={19}
                        placeholder="0000 0000 0000 0000" 
                        value={form.card}
                        className="w-full bg-black/60 border border-white/10 p-8 rounded-[3rem] outline-none focus:border-red-600 focus:bg-black transition-all font-mono text-3xl tracking-[0.3em] text-white placeholder:text-zinc-900 focus:ring-[15px] focus:ring-red-600/5 shadow-2xl" 
                        onChange={e => setForm({...form, card: formatCard(e.target.value)})} 
                      />
                      <div className="absolute right-10 top-1/2 -translate-y-1/2 flex gap-4 opacity-10 group-focus-within:opacity-100 transition-opacity duration-500">
                         <div className="w-14 h-9 bg-zinc-800 rounded-lg"></div>
                         <div className="w-14 h-9 bg-zinc-700 rounded-lg"></div>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Exp & Security */}
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-5">
                      <label className="text-[11px] font-black uppercase text-zinc-500 ml-6 tracking-[0.4em] flex items-center gap-3">
                        <Calendar size={14} className="text-red-600"/> Expiration
                      </label>
                      <input 
                        required 
                        maxLength={5}
                        placeholder="MM/YY" 
                        className="w-full bg-black/40 border border-white/10 p-7 rounded-[2.5rem] outline-none focus:border-red-600 focus:bg-black transition-all text-center font-black text-2xl text-white placeholder:text-zinc-900" 
                        onChange={e => setForm({...form, expiry: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-5">
                      <label className="text-[11px] font-black uppercase text-zinc-500 ml-6 tracking-[0.4em] flex items-center gap-3">
                        <Lock size={14} className="text-red-600"/> Cryptogramme
                      </label>
                      <input 
                        required 
                        type="password" 
                        maxLength={4}
                        placeholder="***" 
                        className="w-full bg-black/40 border border-white/10 p-7 rounded-[2.5rem] outline-none focus:border-red-600 focus:bg-black transition-all text-center font-black text-2xl text-white placeholder:text-zinc-900" 
                        onChange={e => setForm({...form, cvv: e.target.value})} 
                      />
                    </div>
                  </div>

                  {/* Submit Area */}
                  <div className="pt-12 relative">
                    {errorMsg && (
                      <div className="absolute -top-6 left-0 right-0 animate-in fade-in slide-in-from-top-2">
                        <p className="text-red-500 text-[11px] font-black uppercase text-center tracking-widest bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                          {errorMsg}
                        </p>
                      </div>
                    )}
                    
                    <button 
                      disabled={processing} 
                      className="w-full bg-red-600 py-10 rounded-[4rem] font-black uppercase italic text-[18px] tracking-[0.4em] text-white shadow-[0_30px_60px_rgba(220,38,38,0.3)] hover:bg-red-700 hover:scale-[1.01] active:scale-[0.98] transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-6 group overflow-hidden relative"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      
                      {processing ? (
                        <>
                          <RefreshCcw className="animate-spin" size={24}/>
                          <span>Traitement Sécurisé...</span>
                        </>
                      ) : (
                        <>
                          <span>Confirmer le Paiement</span>
                          <ArrowRight size={24} className="group-hover:translate-x-3 transition-transform duration-500" />
                        </>
                      )}
                    </button>
                    
                    <div className="mt-12 flex flex-col items-center gap-6 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-700">
                       <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.5em]">Accepted Networks</p>
                       <div className="flex gap-10">
                          <div className="h-6 w-12 bg-zinc-800 rounded"></div>
                          <div className="h-6 w-12 bg-zinc-700 rounded"></div>
                          <div className="h-6 w-12 bg-zinc-800 rounded"></div>
                          <div className="h-6 w-12 bg-zinc-700 rounded"></div>
                       </div>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==========================================
          DYNAMIC OVERLAYS & PORTALS
      ========================================== */}
      {showSecureOverlay && processing && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-[50px] flex flex-col items-center justify-center animate-in fade-in duration-700">
           <div className="relative mb-16 scale-150">
              <div className="w-32 h-32 border-[4px] border-red-600/10 border-t-red-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldCheck size={45} className="text-red-600 animate-pulse shadow-red-600/50"/>
              </div>
           </div>
           
           <div className="text-center space-y-4">
              <h3 className="text-3xl font-black uppercase italic tracking-[0.5em] text-white">Validation Hatex</h3>
              <div className="flex flex-col items-center gap-2">
                 <p className="text-zinc-500 font-mono text-[11px] uppercase tracking-widest animate-pulse">Requesting bank authorization...</p>
                 <div className="h-1 w-64 bg-zinc-900 rounded-full mt-4 overflow-hidden">
                    <div className="h-full bg-red-600 animate-progress"></div>
                 </div>
              </div>
           </div>

           <div className="absolute bottom-20 left-0 right-0 flex justify-center opacity-20">
              <div className="flex items-center gap-8 text-[10px] font-mono text-zinc-500">
                 <span>PCI-DSS COMPLIANT</span>
                 <span>ISO-27001</span>
                 <span>3D SECURE 2.0</span>
              </div>
           </div>
        </div>
      )}

      {/* Global Style Injector for Custom Scrollbar */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(220, 38, 38, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(220, 38, 38, 0.3);
        }
        @keyframes reverse-spin {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-reverse-spin {
          animation: reverse-spin 3s linear infinite;
        }
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-progress {
          animation: progress 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// ==========================================
// 6. MAIN EXPORT WRAPPER
// ==========================================
export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CheckoutContent />
    </Suspense>
  );
}