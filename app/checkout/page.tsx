"use client";
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Lock, CreditCard, CheckCircle2, 
  MapPin, Phone, FileText, Download,
  AlertTriangle, Building2, Package,
  ArrowRight, ShieldCheck, ShoppingCart, User,
  ChevronRight, Globe, Info
} from 'lucide-react';

// Konpozan Loading pou Suspense
const LoadingScreen = () => (
  <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4">
    <div className="w-12 h-12 border-4 border-red-600/20 border-t-red-600 rounded-full animate-spin"></div>
    <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Chargement Sécurisé...</p>
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

  // SDK Metadata (Pou sa k soti nan lòt sit)
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

  // Sekirite: Maske Non
  const maskName = (name: string) => {
    if (!name) return "Kli...";
    const base = name.includes('@') ? name.split('@')[0] : name;
    return base.substring(0, 3) + "...";
  };

  useEffect(() => {
    const initCheckout = async () => {
      const invId = searchParams.get('invoice_id');
      const termId = searchParams.get('terminal');

      try {
        if (invId) {
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
          setCheckoutType('sdk');
          setReceiverId(termId);
          setAmount(Number(searchParams.get('amount')) || 0);
          setOrderId(searchParams.get('order_id') || `HTX-${Math.random().toString(36).slice(2, 9).toUpperCase()}`);
          
          const { data: prof } = await supabase.from('profiles').select('business_name, kyc_status').eq('id', termId).single();
          if (prof) {
            setBusinessName(prof.business_name || 'Hatex Merchant');
            setKycStatus(prof.kyc_status);
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    };

    initCheckout();
  }, [searchParams, supabase]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setErrorMsg('');

    try {
      if (!receiverId || amount <= 0) throw new Error("Montan peman an pa kòrèk.");

      const rawCustomerName = checkoutType === 'invoice' ? (invoice?.client_email || 'Kliyan') : sdkData.customer_name;

      const { data, error: rpcError } = await supabase.rpc('process_secure_payment', {
        p_terminal_id: receiverId,
        p_card_number: form.card.replace(/\s/g, ''),
        p_card_cvv: form.cvv,
        p_card_expiry: form.expiry,
        p_amount: amount,
        p_order_id: orderId,
        p_customer_name: maskName(rawCustomerName), 
        p_platform: checkoutType === 'invoice' ? `Invoice: ${businessName}` : sdkData.platform,
        p_metadata: { ...sdkData, card_holder: `${form.firstName} ${form.lastName}` }
      });

      if (rpcError) throw rpcError;

      if (data.success) {
        if (checkoutType === 'invoice') {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice.id);
        }
        setAlreadyPaid(true);
      } else {
        throw new Error(data.message || "Tranzaksyon an echwe.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Yon erè rive.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-red-600/30">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        
        {/* SIDEBAR ENFÒMASYON (LÒD LA) */}
        <div className="lg:col-span-5 p-6 lg:p-12 bg-white/[0.01] border-r border-white/5 flex flex-col">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center shadow-2xl shadow-red-600/20">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter leading-none">
                {checkoutType === 'sdk' ? sdkData.shop_name : businessName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {kycStatus === 'approved' && (
                  <span className="flex items-center gap-1 text-[8px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded border border-green-500/20 font-black uppercase">
                    <CheckCircle2 size={8}/> Vérifié
                  </span>
                )}
                <span className="text-[9px] text-zinc-600 font-mono tracking-widest">{orderId}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-8">
            {checkoutType === 'sdk' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="group relative bg-white/5 border border-white/10 p-4 rounded-2xl flex gap-4 hover:border-red-600/50 transition-all">
                  <div className="w-24 h-24 bg-black rounded-xl border border-white/10 overflow-hidden flex-shrink-0">
                    {sdkData.product_image ? (
                      <img src={sdkData.product_image} alt="product" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700"><Package size={32}/></div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center">
                    <h3 className="font-bold text-sm uppercase text-zinc-200">{sdkData.product_name}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-[10px] bg-white/5 px-2 py-1 rounded-md text-zinc-400">QTÉ: {sdkData.quantity}</span>
                      {sdkData.color && <span className="text-[10px] bg-white/5 px-2 py-1 rounded-md text-zinc-400">COULEUR: {sdkData.color}</span>}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="p-2 bg-red-600/10 rounded-lg text-red-500"><MapPin size={18}/></div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-zinc-500 mb-1">Livraison</p>
                      <p className="text-xs text-zinc-300 leading-relaxed">{sdkData.customer_address}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <span className="text-[10px] font-black uppercase text-zinc-500">Détails Facture</span>
                  <FileText size={16} className="text-zinc-600"/>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400 font-medium">Destinataire</span>
                  <span className="text-sm font-bold text-white">{invoice?.client_email}</span>
                </div>
                <div className="p-3 bg-red-600/5 border border-red-600/10 rounded-xl text-[10px] text-red-400 font-medium leading-relaxed">
                  Cette facture expire dans 24 heures. Assurez-vous de finaliser le paiement avant l'échéance.
                </div>
              </div>
            )}
          </div>

          <div className="mt-12 pt-8 border-t border-white/5">
             <div className="flex items-baseline justify-between">
                <div>
                   <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1">Total à régler</p>
                   <div className="flex items-baseline gap-2">
                      <span className="text-6xl font-black tracking-tighter italic">{amount.toLocaleString()}</span>
                      <span className="text-xl font-bold text-red-600">HTG</span>
                   </div>
                </div>
                <div className="text-right">
                   <div className="text-[10px] text-zinc-600 font-bold uppercase mb-1">Taxe Incluse</div>
                   <div className="text-xs text-zinc-400 font-mono">0.00 HTG</div>
                </div>
             </div>
          </div>
        </div>

        {/* SECTION PEMAN (CHÈKOUT) */}
        <div className="lg:col-span-7 bg-[#0a0b12] p-6 lg:p-20 flex flex-col justify-center relative overflow-hidden">
          {/* Background Decor */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="relative z-10 max-w-md mx-auto w-full">
            {alreadyPaid ? (
              <div className="text-center space-y-8 animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-green-500 rounded-full mx-auto flex items-center justify-center shadow-2xl shadow-green-500/20">
                  <CheckCircle2 size={48} className="text-black" />
                </div>
                <div>
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter">Paiement Réussi</h2>
                  <p className="text-zinc-500 mt-2">Votre transaction a été validée avec succès.</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <button onClick={() => window.print()} className="w-full bg-white text-black py-4 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all">
                    <Download size={16}/> Imprimer le Reçu
                  </button>
                  <button onClick={() => router.back()} className="w-full bg-white/5 border border-white/10 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all">
                    Retourner au magasin
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                <div className="flex items-center justify-between">
                   <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tight">Paiement</h2>
                      <p className="text-zinc-500 text-xs mt-1">Transaction 100% cryptée et sécurisée.</p>
                   </div>
                   <div className="flex gap-2">
                      <div className="w-8 h-5 bg-white/10 rounded flex items-center justify-center"><Globe size={10} className="text-zinc-500"/></div>
                      <div className="w-8 h-5 bg-white/10 rounded flex items-center justify-center"><Lock size={10} className="text-zinc-500"/></div>
                   </div>
                </div>

                <form onSubmit={handlePayment} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500 ml-1 tracking-widest">Prénom</label>
                      <input required placeholder="John" className="w-full bg-black border border-white/10 p-4 rounded-xl outline-none focus:border-red-600 transition-all text-sm font-medium" onChange={e => setForm({...form, firstName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500 ml-1 tracking-widest">Nom</label>
                      <input required placeholder="Doe" className="w-full bg-black border border-white/10 p-4 rounded-xl outline-none focus:border-red-600 transition-all text-sm font-medium" onChange={e => setForm({...form, lastName: e.target.value})} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 ml-1 tracking-widest">Numéro de carte</label>
                    <div className="relative">
                      <input required placeholder="0000 0000 0000 0000" className="w-full bg-black border border-white/10 p-4 rounded-xl outline-none focus:border-red-600 transition-all font-mono tracking-widest text-sm" 
                        onChange={e => {
                          let v = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                          setForm({...form, card: v});
                        }} 
                        maxLength={19}
                      />
                      <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700" size={18}/>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500 ml-1 tracking-widest">Expiration</label>
                      <input required placeholder="MM / YY" maxLength={5} className="w-full bg-black border border-white/10 p-4 rounded-xl outline-none focus:border-red-600 transition-all text-center font-mono text-sm" 
                        onChange={e => {
                          let v = e.target.value.replace(/\D/g, '');
                          if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2,4);
                          setForm({...form, expiry: v});
                        }} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500 ml-1 tracking-widest">CVC / CVV</label>
                      <input required type="password" placeholder="***" maxLength={4} className="w-full bg-black border border-white/10 p-4 rounded-xl outline-none focus:border-red-600 transition-all text-center font-mono text-sm" onChange={e => setForm({...form, cvv: e.target.value})} />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button disabled={processing} className="w-full bg-red-600 group relative overflow-hidden py-5 rounded-xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50">
                      <div className="relative z-10 flex items-center justify-center gap-3">
                        {processing ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <>CONFIRMER LE PAIEMENT <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform"/></>
                        )}
                      </div>
                    </button>
                  </div>
                </form>

                {errorMsg && (
                  <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-[10px] font-black uppercase animate-shake">
                    <AlertTriangle size={16} className="flex-shrink-0"/>
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="flex flex-col items-center gap-6 pt-6 opacity-40">
                  <div className="flex items-center gap-8">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" className="h-3 grayscale invert" alt="visa" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-5 grayscale invert" alt="mastercard" />
                    <div className="h-4 w-px bg-white/20"></div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14}/>
                      <span className="text-[8px] font-black uppercase tracking-[0.3em]">PCI-DSS Compliant</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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