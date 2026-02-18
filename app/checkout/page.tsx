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
  const [sdkItems, setSdkItems] = useState<any[]>([]); // Pou jere plizyè atik si se yon panyen
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({ firstName: '', lastName: '', card: '', expiry: '', cvv: '' });

  // --- FONKSYON POU BOUCHE NON AN (Eme...) ---
  const maskName = (name: string) => {
    if (!name) return "Kli...";
    const base = name.includes('@') ? name.split('@')[0] : name;
    return base.substring(0, 3) + "...";
  };

  // --- VERIFIKASYON KAT ---
  const validateForm = () => {
    const cardNumber = form.card.replace(/\s/g, '');
    if (cardNumber.length < 15 || cardNumber.length > 19) return "Nimewo kat la pa gen bon longè.";
    if (form.cvv.length < 3 || form.cvv.length > 4) return "Kòd CVV/CVC a dwe gen 3 oswa 4 chif.";
    if (!form.firstName.trim() || !form.lastName.trim()) return "Mete non ak siyati ki sou kat la.";
    const [month, year] = form.expiry.split('/');
    if (!month || !year) return "Fòma dat la dwe MM/YY.";
    return null;
  };

  // --- 1. INITIALIZATION & DETECTION (INVOICE VS SDK) ---
  useEffect(() => {
    const init = async () => {
      const invId = searchParams.get('invoice_id');
      const token = searchParams.get('token'); // Pou panyen SDK konple
      const termId = searchParams.get('terminal'); // Pou link senp

      try {
        if (invId) {
          // --- PATI INVOICE (PA MANYEN) ---
          setCheckoutType('invoice');
          const { data: inv, error } = await supabase.from('invoices').select('*').eq('id', invId).single();
          if (error || !inv) throw new Error("Fakti sa a pa valid.");
          setInvoice(inv);
          setReceiverId(inv.owner_id);
          setAmount(Number(inv.amount));
          const { data: prof } = await supabase.from('profiles').select('business_name, kyc_status').eq('id', inv.owner_id).single();
          if (prof) {
            setBusinessName(prof.business_name || 'Hatex Merchant');
            setKycStatus(prof.kyc_status);
          }
          setOrderId(`INV-${inv.id.slice(0, 8).toUpperCase()}`);
          if (inv.status === 'paid') setAlreadyPaid(true);

        } else if (token || termId) {
          // --- PATI SDK (PANYEN OSWA LINK) ---
          setCheckoutType('sdk');
          
          if (token) {
            // Si se yon panyen konplè ki soti nan SDK a
            const decoded = JSON.parse(decodeURIComponent(atob(token)));
            setSdkItems(decoded.items || []);
            setCustomerInfo(decoded.customer);
            setAmount(Number(decoded.amount));
            setReceiverId(decoded.terminal);
            setBusinessName(decoded.shop_name || "Hatex Merchant");
            setOrderId(`SDK-${Math.random().toString(36).slice(2, 9).toUpperCase()}`);
          } else {
            // Si se yon link senp ak paramèt URL
            setReceiverId(termId);
            setAmount(Number(searchParams.get('amount')) || 0);
            setCustomerInfo({
              name: searchParams.get('customer_name'),
              address: searchParams.get('customer_address'),
              phone: searchParams.get('customer_phone')
            });
            setSdkItems([{
              name: searchParams.get('product_name') || 'Pwodwi',
              img: searchParams.get('product_image'),
              qty: searchParams.get('quantity') || '1',
              variants: `Color: ${searchParams.get('color') || 'N/A'}, Size: ${searchParams.get('size') || 'N/A'}`
            }]);
            setOrderId(searchParams.get('order_id') || `SDK-${Math.random().toString(36).slice(2, 9).toUpperCase()}`);
          }

          // Chache KYC machann nan si nou gen terminal ID a
          const tid = token ? JSON.parse(decodeURIComponent(atob(token))).terminal : termId;
          const { data: prof } = await supabase.from('profiles').select('kyc_status, business_name').eq('id', tid).single();
          if (prof) {
            setKycStatus(prof.kyc_status);
            if(!token) setBusinessName(prof.business_name);
          }
        }
      } catch (err: any) {
        setErrorMsg("Erè nan chaje done yo.");
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

    const validationError = validateForm();
    if (validationError) {
      setErrorMsg(validationError);
      setProcessing(false);
      return;
    }

    try {
      const rawCustomerName = checkoutType === 'invoice' ? (invoice?.client_email || 'Kliyan') : (customerInfo?.name || 'Kliyan');
      
      const transactionMetadata = {
        items: sdkItems,
        customer: customerInfo,
        shop_name: businessName,
        card_holder: `${form.firstName} ${form.lastName}`
      };

      const { data, error: rpcError } = await supabase.rpc('process_secure_payment', {
        p_terminal_id: receiverId,
        p_card_number: form.card.replace(/\s/g, ''),
        p_card_cvv: form.cvv,
        p_card_expiry: form.expiry,
        p_amount: amount,
        p_order_id: orderId,
        p_customer_name: maskName(rawCustomerName), 
        p_platform: checkoutType === 'invoice' ? 'Hatex Invoice' : (searchParams.get('platform') || 'Hatex SDK'),
        p_metadata: transactionMetadata 
      });

      if (rpcError) throw rpcError;

      if (data.success) {
        if (checkoutType === 'invoice') {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice.id);
        }
        setAlreadyPaid(true);
      } else {
        throw new Error(data.message || "Peman an echwe.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Echèk tranzaksyon.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-red-600 font-black text-xs uppercase animate-pulse">Chargement Hatex...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-900/30">
      <div className="max-w-6xl mx-auto min-h-screen grid grid-cols-1 lg:grid-cols-2">
        
        {/* --- KOLÒN GÒCH: REZIME --- */}
        <div className="p-8 lg:p-16 flex flex-col bg-white/[0.02] border-r border-white/5">
          <div className="mb-10 flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-red-600 to-red-900 rounded-2xl flex items-center justify-center">
              <Building2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase">{businessName}</h1>
              <div className="flex items-center gap-2">
                 {kycStatus === 'approved' && (
                   <span className="flex items-center gap-1 text-[9px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded border border-green-500/20 font-black uppercase">
                     <CheckCircle2 size={10} /> Verifié
                   </span>
                 )}
                 <span className="text-[9px] text-zinc-500 font-mono">REF: {orderId}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-6">
            {checkoutType === 'sdk' && sdkItems.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="w-16 h-16 bg-black rounded-xl border border-white/10 overflow-hidden shrink-0">
                  {item.img ? <img src={item.img} className="w-full h-full object-cover" /> : <Package size={20} className="m-auto mt-5 text-zinc-700"/>}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm uppercase">{item.name}</h3>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase">{item.variants}</p>
                  <span className="inline-block mt-2 text-[10px] bg-white/10 px-2 py-1 rounded font-bold">QTY: {item.qty}</span>
                </div>
              </div>
            ))}

            {checkoutType === 'sdk' && customerInfo && (
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <MapPin className="text-red-500 mb-2" size={16} />
                  <p className="text-[9px] text-zinc-500 uppercase font-bold">Adresse</p>
                  <p className="text-xs truncate">{customerInfo.address}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <Phone className="text-red-500 mb-2" size={16} />
                  <p className="text-[9px] text-zinc-500 uppercase font-bold">Contact</p>
                  <p className="text-xs">{customerInfo.phone}</p>
                </div>
              </div>
            )}

            {checkoutType === 'invoice' && invoice && (
               <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-3">
                     <FileText className="text-zinc-400" size={20} />
                     <span className="text-xs font-black uppercase text-zinc-400">Facture Hatex</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-zinc-500 text-sm">Destinataire:</p>
                    <p className="font-bold text-white">{invoice.client_email}</p>
                  </div>
               </div>
            )}

            <div className="pt-8 mt-auto border-t border-white/5">
               <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase text-zinc-500">Total à payer</span>
                  <div className="flex items-baseline gap-2">
                     <span className="text-5xl font-black text-white">{amount.toLocaleString()}</span>
                     <span className="text-xl font-bold text-red-600">HTG</span>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* --- KOLÒN DWAT: PEMAN --- */}
        <div className="bg-[#0a0b12] p-8 lg:p-20 flex flex-col justify-center">
          {alreadyPaid ? (
            <div className="text-center space-y-8 animate-in zoom-in-50">
              <div className="w-24 h-24 bg-green-500 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-green-500/20">
                <CheckCircle2 size={40} className="text-black" />
              </div>
              <div>
                <h2 className="text-3xl font-black uppercase italic">Paiement Reçu</h2>
                <div className="mt-4 p-5 rounded-2xl bg-green-500/10 border border-green-500/20 text-left">
                  <p className="text-white text-sm">
                    Felisitasyon! Ou sot peye <b>{amount.toLocaleString()} HTG</b> bay <b>{businessName}</b>. 
                    Yo resevwa komann ou an epi w ap jwenn yon konfimasyon talè.
                  </p>
                </div>
              </div>
              <button onClick={() => window.print()} className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase flex items-center justify-center gap-2">
                <Download size={18}/> Télécharger Reçu
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <h2 className="text-2xl font-bold">Paiement Sécurisé</h2>
              <form onSubmit={handlePayment} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Prénom" className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 text-white text-sm" onChange={e => setForm({...form, firstName: e.target.value})} />
                  <input required placeholder="Nom" className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 text-white text-sm" onChange={e => setForm({...form, lastName: e.target.value})} />
                </div>
                <div className="relative">
                  <input required placeholder="0000 0000 0000 0000" className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 text-white font-mono text-lg" onChange={e => setForm({...form, card: e.target.value})} />
                  <CreditCard className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-700" size={20}/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="MM/YY" maxLength={5} className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 text-white text-center font-mono" onChange={e => {
                    let v = e.target.value.replace(/\D/g, '');
                    if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2,4);
                    setForm({...form, expiry: v});
                  }} />
                  <input required type="password" maxLength={4} placeholder="CVC" className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 text-white text-center font-mono" onChange={e => setForm({...form, cvv: e.target.value})} />
                </div>
                
                {errorMsg && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold uppercase">{errorMsg}</div>}

                <button disabled={processing} className="w-full bg-red-600 hover:bg-red-700 py-6 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50">
                  {processing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <>PAYER MAINTENANT <ArrowRight size={18}/></>}
                </button>
              </form>
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