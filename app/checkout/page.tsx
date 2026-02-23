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

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'invoice' | 'sdk'>('sdk');
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState('');
  const [businessName, setBusinessName] = useState('Hatex Merchant');
  const [kycStatus, setKycStatus] = useState<string>('');
  const [invoice, setInvoice] = useState<any>(null);

  const [form, setForm] = useState({ firstName: '', lastName: '', card: '', expiry: '', cvv: '' });

  // ==========================================
  // LOJIK SDK DATA (RANJE POU PWODWI)
  // ==========================================
  const sdkData = useMemo(() => {
    const token = searchParams.get('token');
    let decodedData: any = {};
    
    if (token) {
        try {
            decodedData = JSON.parse(decodeURIComponent(escape(atob(token))));
        } catch(e) {
            console.error("Decode Error");
        }
    }

    // Standardizasyon Pwodwi yo pou UI a ka li yo fasil
    let productList = [];
    const rawItems = decodedData.order_details?.items || decodedData.cart || decodedData.items;

    if (Array.isArray(rawItems)) {
        productList = rawItems.map((item: any) => ({
            name: item.name || item.product_name || 'Produit',
            image: item.image || item.img || item.picture || null,
            price: Number(item.price || 0),
            qty: Number(item.qty || item.quantity || 1),
            variant: item.variant || item.color || item.size || ''
        }));
    } else if (decodedData.product_name || decodedData.amount) {
        productList = [{
            name: decodedData.product_name || 'Achat Boutique',
            image: decodedData.image || decodedData.img || null,
            price: Number(decodedData.amount || 0),
            qty: Number(decodedData.quantity || 1),
            variant: decodedData.variant || ''
        }];
    }

    const allNames = productList.map(p => `${p.qty}x ${p.name}`).join(', ');

    return {
      shop_name: decodedData.shop_name || searchParams.get('shop_name') || 'Hatex Merchant',
      products: productList,
      all_product_names_string: allNames,
      subtotal: Number(decodedData.order_details?.subtotal || 0),
      shipping_fee: Number(decodedData.order_details?.shipping_fee || 0),
      shipping_zone: decodedData.order_details?.shipping_zone || 'Haiti',
      customer_name: decodedData.customer?.full_name || decodedData.customer_name || 'Kliyan',
      customer_email: decodedData.customer?.email || decodedData.customer_email || '',
      customer_phone: decodedData.customer?.phone || decodedData.customer_phone || '',
      customer_address: decodedData.customer?.address || decodedData.customer_address || '',
      terminal: decodedData.terminal || searchParams.get('terminal'),
      total_amount: Number(decodedData.amount || searchParams.get('amount') || 0),
      platform: "Hatex SDK v6.0"
    };
  }, [searchParams]);

  useEffect(() => {
    const init = async () => {
      const invId = searchParams.get('invoice_id');
      const termId = sdkData.terminal;
      try {
        if (invId) {
          setCheckoutType('invoice');
          const { data: inv } = await supabase.from('invoices').select('*').eq('id', invId).single();
          if (inv) {
            setInvoice(inv);
            setReceiverId(inv.owner_id);
            setAmount(Number(inv.amount));
            setOrderId(`INV-${inv.id.slice(0, 8).toUpperCase()}`);
            if (inv.status === 'paid') setAlreadyPaid(true);
            const { data: p } = await supabase.from('profiles').select('business_name, kyc_status').eq('id', inv.owner_id).single();
            if (p) { setBusinessName(p.business_name); setKycStatus(p.kyc_status); }
          }
        } else {
          setCheckoutType('sdk');
          setReceiverId(termId);
          setAmount(sdkData.total_amount);
          setOrderId(searchParams.get('order_id') || `HTX-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
          if (termId) {
            const { data: p } = await supabase.from('profiles').select('business_name, kyc_status').eq('id', termId).single();
            if (p) { setBusinessName(p.business_name); setKycStatus(p.kyc_status); }
          }
        }
      } catch (e) {} finally { setLoading(false); }
    };
    init();
  }, [searchParams, supabase, sdkData]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.rpc('process_secure_payment', {
        p_terminal_id: receiverId,
        p_card_number: form.card.replace(/\s/g, ''),
        p_card_cvv: form.cvv,
        p_card_expiry: form.expiry,
        p_amount: amount,
        p_order_id: orderId,
        p_customer_name: sdkData.customer_name,
        p_platform: sdkData.platform,
        p_metadata: { ...sdkData, holder: `${form.firstName} ${form.lastName}` }
      });
      if (error) throw error;
      if (data.success) {
        if (checkoutType === 'invoice') await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice.id);
        setAlreadyPaid(true);
      } else throw new Error(data.message);
    } catch (err: any) { setErrorMsg(err.message); } finally { setProcessing(false); }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-600/30">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        
        {/* ========================================================= */}
        {/* SIDEBAR GÒCH (PANYEN AN) - KORIJE */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 p-6 lg:p-12 bg-white/[0.01] border-r border-white/5 flex flex-col h-full overflow-y-auto custom-scrollbar">
          
          {/* Header Machann */}
          <div className="flex items-center gap-4 mb-10 sticky top-0 bg-[#050505]/95 backdrop-blur-xl z-20 py-4">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-600/20 transform -rotate-3"><Building2 size={26} /></div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter leading-none mb-1">{businessName}</h1>
              <div className="flex items-center gap-2">
                {kycStatus === 'approved' && <span className="text-[8px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full border border-green-500/20 font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={10}/> Vérifié</span>}
                <span className="text-[9px] text-zinc-600 font-mono bg-white/5 px-2 py-0.5 rounded italic">#{orderId}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-10">
            {checkoutType === 'sdk' ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {/* LIS PWODWI YO (KORIJE) */}
                <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2 px-1">
                        <ShoppingCart size={12} className="text-red-600"/> Votre Panier
                    </p>
                    
                    <div className="space-y-3">
                        {sdkData.products.length > 0 ? sdkData.products.map((item: any, idx: number) => (
                            <div key={idx} className="group bg-zinc-900/40 border border-white/5 p-4 rounded-[2rem] flex gap-4 hover:bg-zinc-900/80 transition-all duration-300">
                                <div className="w-20 h-20 bg-black rounded-2xl border border-white/5 overflow-hidden flex-shrink-0 shadow-2xl">
                                    {item.image ? (
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-800 bg-zinc-900"><Package size={28}/></div>
                                    )}
                                </div>
                                <div className="flex flex-col justify-center flex-1 min-w-0">
                                    <h3 className="font-bold text-[13px] uppercase text-zinc-100 truncate">{item.name}</h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[9px] bg-white/5 px-2 py-1 rounded text-zinc-400 font-black uppercase">Qté: {item.qty}</span>
                                        {item.variant && <span className="text-[9px] bg-red-600/10 px-2 py-1 rounded text-red-500 font-black uppercase italic">{item.variant}</span>}
                                    </div>
                                </div>
                                <div className="text-right flex flex-col justify-center">
                                    <p className="text-sm font-black text-white">{(item.price * item.qty).toLocaleString()}</p>
                                    <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">HTG</p>
                                </div>
                            </div>
                        )) : (
                          <div className="p-10 border border-dashed border-white/5 rounded-[2.5rem] text-center text-zinc-600 font-bold text-xs">Panyen an pa gen okenn atik</div>
                        )}
                    </div>
                </div>

                {/* DETAY LIVREZON */}
                <div className="bg-zinc-900/30 border border-white/5 rounded-[2.5rem] overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2"><Truck size={14} className="text-red-600"/> Expédition</p>
                        <span className="text-[10px] font-black text-white uppercase italic">{sdkData.shipping_zone}</span>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-red-600/10 rounded-2xl text-red-500"><User size={18}/></div>
                            <div>
                                <p className="text-[9px] font-black uppercase text-zinc-500 mb-0.5">Destinataire</p>
                                <p className="text-sm font-bold text-zinc-200">{sdkData.customer_name}</p>
                                <p className="text-[11px] text-zinc-500">{sdkData.customer_phone}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-red-600/10 rounded-2xl text-red-500"><MapPin size={18}/></div>
                            <div>
                                <p className="text-[9px] font-black uppercase text-zinc-500 mb-0.5">Adresse</p>
                                <p className="text-[12px] font-medium text-zinc-400 italic leading-snug">{sdkData.customer_address || 'Non spécifiée'}</p>
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            ) : (
              /* --- PATI INVOICE LA (PA MANYEN) --- */
              <div className="bg-zinc-900/30 border border-white/5 rounded-[2.5rem] p-8 space-y-6">
                <div className="flex items-center gap-3 border-b border-white/5 pb-6">
                    <div className="p-3 bg-white/5 rounded-xl text-zinc-400"><FileText size={20}/></div>
                    <span className="text-xs font-black uppercase text-white tracking-widest">Facture Digitale</span>
                </div>
                <div className="flex items-start gap-5">
                    <div className="p-4 bg-red-600/10 rounded-2xl text-red-500"><Mail size={24}/></div>
                    <div>
                        <span className="text-[10px] text-zinc-500 font-black uppercase block mb-1">Envoyé à</span>
                        <span className="text-lg font-bold text-white block underline decoration-red-600/30 underline-offset-4">{invoice?.client_email}</span>
                    </div>
                </div>
              </div>
            )}
          </div>

          {/* TOTAL FOOTER */}
          <div className="mt-12 pt-8 border-t border-white/5 sticky bottom-0 bg-[#050505] z-30 pb-6">
              {sdkData.shipping_fee > 0 && (
                <div className="flex justify-between items-center mb-5 px-2 text-[10px] font-black uppercase tracking-widest">
                   <span className="text-zinc-500">Sous-total: {sdkData.subtotal.toLocaleString()} HTG</span>
                   <span className="text-red-500">Livraison: +{sdkData.shipping_fee.toLocaleString()} HTG</span>
                </div>
              )}
              <div className="flex items-end justify-between px-2">
                <div>
                   <p className="text-[10px] font-black uppercase text-zinc-600 tracking-[0.3em] mb-2">Montant à Payer</p>
                   <div className="flex items-baseline gap-2">
                      <span className="text-6xl lg:text-7xl font-black tracking-tighter italic text-white">{amount.toLocaleString()}</span>
                      <span className="text-xl font-black text-red-600 italic">HTG</span>
                   </div>
                </div>
                <div className="text-right pb-2">
                   <div className="bg-green-500/10 text-green-500 text-[8px] font-black uppercase py-1 px-3 rounded-full border border-green-500/20 mb-2 inline-block">SÉCURISÉ</div>
                   <p className="text-[8px] text-zinc-700 font-mono tracking-tighter uppercase tracking-widest">GATEWAY V6.0</p>
                </div>
              </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION PEYE AK KAT (DWAT) */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 bg-[#08090f] p-6 lg:p-24 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="relative z-10 max-w-md mx-auto w-full">
            {alreadyPaid ? (
              <div className="text-center space-y-10 animate-in zoom-in-95 duration-700">
                <div className="w-28 h-28 bg-green-500 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-2xl rotate-12 shadow-green-500/20"><CheckCircle2 size={56} className="text-black" /></div>
                <div className="space-y-3">
                  <h2 className="text-5xl font-black uppercase italic tracking-tighter text-white">Succès !</h2>
                  <p className="text-zinc-500 text-sm font-medium">Votre transaction a été traitée avec succès.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 pt-6">
                  <button onClick={() => window.print()} className="w-full bg-white text-black py-5 rounded-[1.2rem] font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all"><Download size={18}/> Reçu PDF</button>
                  <button onClick={() => window.history.back()} className="w-full bg-white/5 border border-white/10 py-5 rounded-[1.2rem] font-black uppercase text-[10px] tracking-[0.3em] text-zinc-400 hover:text-white transition-all">Retourner au Magasin</button>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                <div className="flex items-center justify-between">
                   <div className="space-y-1">
                      <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3">Paiement <CreditCardIcon className="text-red-600" size={24}/></h2>
                      <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest">Hatex Secure Processing</p>
                   </div>
                </div>

                <form onSubmit={handlePayment} className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Prénom</label>
                      <input required placeholder="Ex: Jean" className="w-full bg-black/50 border border-white/5 p-4 rounded-2xl outline-none focus:border-red-600/50 text-sm font-bold text-white transition-all" onChange={e => setForm({...form, firstName: e.target.value})} />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Nom</label>
                      <input required placeholder="Ex: Dupont" className="w-full bg-black/50 border border-white/5 p-4 rounded-2xl outline-none focus:border-red-600/50 text-sm font-bold text-white transition-all" onChange={e => setForm({...form, lastName: e.target.value})} />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Numéro de Carte Hatex</label>
                    <div className="relative group">
                      <input required placeholder="0000 0000 0000 0000" className="w-full bg-black/50 border border-white/5 p-5 rounded-2xl outline-none focus:border-red-600 font-mono tracking-[0.3em] text-sm text-white transition-all" 
                        onChange={e => setForm({...form, card: e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim()})} maxLength={19} />
                      <CreditCard className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-red-600 transition-colors" size={20}/>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 ml-1 tracking-widest">Expiration</label>
                      <input required placeholder="MM / YY" maxLength={5} className="w-full bg-black/50 border border-white/5 p-5 rounded-2xl outline-none focus:border-red-600 text-center font-mono text-sm font-black text-white" 
                        onChange={e => {
                          let v = e.target.value.replace(/\D/g, '');
                          if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2,4);
                          setForm({...form, expiry: v});
                        }} />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 ml-1 tracking-widest">CVV</label>
                      <input required type="password" placeholder="***" maxLength={4} className="w-full bg-black/50 border border-white/5 p-5 rounded-2xl outline-none focus:border-red-600 text-center font-mono text-sm font-black text-white" onChange={e => setForm({...form, cvv: e.target.value})} />
                    </div>
                  </div>

                  <div className="pt-8">
                    <button disabled={processing} className="w-full bg-red-600 group relative overflow-hidden py-6 rounded-[1.5rem] font-black uppercase tracking-[0.3em] text-[11px] hover:bg-red-700 active:scale-[0.97] transition-all disabled:opacity-50 shadow-2xl shadow-red-600/20">
                      <div className="relative z-10 flex items-center justify-center gap-4">
                        {processing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <>CONFIRMER LE PAIEMENT <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform"/></>}
                      </div>
                    </button>
                  </div>
                </form>

                {errorMsg && (
                  <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-500 text-[10px] font-black uppercase animate-shake">
                    <AlertTriangle size={20} className="flex-shrink-0"/>
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="flex flex-col items-center gap-8 pt-10 border-t border-white/5 opacity-40 grayscale">
                  <div className="flex items-center gap-10">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" className="h-3 invert" alt="visa" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-6 invert" alt="mastercard" />
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-white"/>
                      <span className="text-[8px] font-black uppercase tracking-[0.4em]">PCI Secure</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
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