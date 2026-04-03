"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Loader2, CreditCard, ShieldCheck, AlertCircle, 
  ArrowLeft, CheckCircle2, Lock, ShieldAlert, 
  Receipt, Phone, CalendarIcon, Hash, MessageCircle
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

export default function SubscribePage() {
  const params = useParams();
  const rawId = params?.id as string;
  const router = useRouter();

  // STATES POU DONE YO
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  
  // STATES POU KAT KREDI KLIYAN AN
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  // STATES POU PEMAN AN AK RESI A
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txId, setTxId] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function getCheckoutData() {
      if (!rawId || rawId === 'undefined') {
        setError("Lyen sa a pa valid.");
        setLoading(false);
        return;
      }

      try {
        let decodedId = '';
        try {
          decodedId = atob(decodeURIComponent(rawId));
        } catch (e) {
          throw new Error("Lyen abònman an kòronpi oswa li pa bon ankò.");
        }

        const { data: p, error: pErr } = await supabase
          .from('products')
          .select('*, profiles(*)')
          .eq('id', decodedId)
          .single();

        if (pErr || !p) throw new Error("Sèvis sa a pa disponib oswa li efase.");
        
        setProduct(p);
        setMerchant(p.profiles);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    getCheckoutData();
  }, [rawId, supabase]);

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    const formatted = value.replace(/(\d{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length > 2) value = `${value.slice(0, 2)}/${value.slice(2)}`;
    setExpiry(value);
  };

// ==========================================
  // LOJIK ENTELIJAN VERIFIKASYON KAT & TRANZAKSYON
  // ==========================================
  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validasyon
    if (cardNumber.replace(/\s/g, '').length !== 16) return setError("Nimewo kat la dwe gen 16 chif.");
    if (expiry.length !== 5) return setError("Dat ekspirasyon an pa valid (MM/YY).");
    if (cvv.length < 3) return setError("CVV a dwe gen 3 oswa 4 chif.");
    if (!cardName.trim()) return setError("Ou dwe mete non ki sou kat la.");

    setProcessing(true);

    try {
      const cleanCard = cardNumber.replace(/\s/g, '');

      // 1. Chache pwofil kliyan an
      const { data: clientProfile, error: cardErr } = await supabase
        .from('profiles') 
        .select('id, card_balance, is_activated, full_name, email') 
        .eq('card_number', cleanCard)
        .eq('cvv', cvv)
        .eq('exp_date', expiry)
        .single();

      if (cardErr || !clientProfile) throw new Error("Kat sa a pa anrejistre nan sistèm H-Pay oswa enfòmasyon yo pa bon.");
      if (clientProfile.is_activated === false) throw new Error("Kont ou bloke alèkile. Tanpri kontakte sipò H-Pay.");
      if (clientProfile.card_balance < product.price) throw new Error(`Ou pa gen ase fon sou kat ou a. Balans aktyèl ou se: ${clientProfile.card_balance} HTG.`);

      // ==========================================
      // 2. TRANZAKSYON KÒB LA
      // ==========================================

      // A) Rache non kliyan an (EME... DOR...) pou pwoteje idantite l
      const nameParts = (clientProfile.full_name || '').trim().split(/\s+/);
      const firstName = nameParts[0] ? nameParts[0].substring(0, 3).toUpperCase() : 'KLI';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1].substring(0, 3).toUpperCase() : 'YAN';
      const maskedName = `${firstName}... ${lastName}...`;

      // Kalkile nouvo balans yo pou nou ka mete yo nan istorik la
      const clientNewBalance = clientProfile.card_balance - product.price;
      const newMerchantBalance = (merchant.wallet_balance || 0) + product.price;

      // B) Mete baz done a ajou pou kliyan an (retire kòb) ak machann nan (ajoute kòb)
      const { error: deductErr } = await supabase.from('profiles').update({ card_balance: clientNewBalance }).eq('id', clientProfile.id);
      if (deductErr) throw new Error("Te gen yon pwoblèm nan retire kòb la sou kat ou.");

      const { error: addErr } = await supabase.from('profiles').update({ wallet_balance: newMerchantBalance }).eq('id', merchant.id);
      if (addErr) throw new Error("Te gen yon pwoblèm nan transfere kòb la bay machann nan.");

// ============================================================
// C) ANREJISTRE ISTORIK LA AK BÈL MESAJ POU TOU 2 MOUN YO
// ============================================================
const fakeTxId = 'HPY-' + Math.random().toString(36).substring(2, 11).toUpperCase();

const { error: txErr } = await supabase
        .from('transactions')
        .insert([
          // 1. MESAJ POU MACHANN NAN
          {
            user_id: merchant.id,
            amount: product.price, 
            type: 'SALE',             
            status: 'success',        
            description: `Vant Abònman: ${product.title} (Kliyan: ${maskedName})`,
            reference_id: `${fakeTxId}-M`,  // <--- KORIJE LA A
            metadata: {
              customer_name: maskedName,
              customer_email: clientProfile.email || '',
              plan_name: product.title,
              payment_method: 'card'
            }
          },
          // 2. MESAJ POU KLIYAN AN
          {
            user_id: clientProfile.id,
            amount: -product.price,   
            type: 'PAYMENT',          
            status: 'success',
            description: `Peman Abònman: ${product.title} nan ${merchant.business_name || 'H-Pay Store'}`,
            reference_id: `${fakeTxId}-C`,  // <--- KORIJE LA A
            metadata: {
              merchant_name: merchant.business_name || 'Biznis San Non',
              plan_name: product.title
            }
          }
        ]);

if (txErr) {
  console.error("❌ Erè nan anrejistreman istorik tranzaksyon:", txErr); 
} 

// ============================================================
// 3. ANREJISTRE TRAS ABÒNMAN AN (PÈMÈT WEBHOOK VOYE IMÈL)
// ============================================================
const { error: subErr } = await supabase
  .from('subscriptions_history')
  .insert({
    merchant_id: merchant.id,
    client_id: clientProfile.id,
    client_email: clientProfile.email || 'Pa gen imèl',
    client_name: clientProfile.full_name || 'Kliyan Hatex',
    shop_name: merchant.business_name || 'Biznis San Non',
    plan_name: product.title,
    amount: product.price,
    status: 'success'
  });

if (subErr) {
  console.error("❌ Erè nan subscriptions_history:", subErr);
} else {
  // Sa a ap kouri sèlman si Sub la byen anrejistre
  console.log("✅ Istorik ak Abònman anrejistre pafètman!");
}
      // Jenere ID Tranzaksyon an ak afiche ekran siksè a
      setTxId(fakeTxId);
      setSuccess(true);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };
  // ==========================================
  // EKRAN LOADING
  // ==========================================
  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-red-600 mb-4 w-12 h-12 md:w-16 md:h-16" />
      <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600 animate-pulse text-center px-4">Loading Secure Checkout...</p>
    </div>
  );

  // ==========================================
  // EKRAN ERÈ
  // ==========================================
  if (error && !product) return (
    <div className="min-h-screen bg-[#06070d] text-white flex flex-col items-center justify-center p-6 text-center">
      <AlertCircle className="text-red-600 mb-6 w-16 h-16 md:w-20 md:h-20" />
      <h1 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter max-w-lg">{error}</h1>
      <button onClick={() => router.push('/')} className="mt-8 bg-white text-black px-8 py-4 rounded-full font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all">Retounen Lakay</button>
    </div>
  );

  // ==========================================
  // EKRAN SIKSÈ & RESI WHATSAPP
  // ==========================================
  if (success) {
    const formattedPhone = product?.contact_phone?.replace(/[^0-9+]/g, '') || '';
    const whatsappMessage = `Bonjou *${merchant?.business_name || "Biznis San Non"}*! Mwen sot peye pou abònman: *${product?.title}*.\n\n💰 *Kantite:* ${product?.price} HTG\n🆔 *ID Tranzaksyon:* ${txId}\n\nTanpri verifye peman m nan epi banm aksè a. Mèsi!`;
    const whatsappLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappMessage)}`;

    return (
      <div className="min-h-screen bg-[#06070d] text-white flex flex-col items-center justify-center p-6 italic text-center selection:bg-red-600">
        <div className="relative mb-8 md:mb-12">
          <div className="absolute inset-0 bg-green-500 blur-[60px] md:blur-[80px] opacity-20 rounded-full" />
          <div className="relative w-24 h-24 md:w-32 md:h-32 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500/30">
            <CheckCircle2 className="text-green-500 w-12 h-12 md:w-16 md:h-16" />
          </div>
        </div>
        
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none mb-4 md:mb-6">Peman <span className="text-green-500">Siksè</span></h1>
        <p className="text-zinc-500 text-sm md:text-base font-bold max-w-md mx-auto mb-8 md:mb-10 leading-relaxed px-4">
          Abònman ou nan <span className="text-white">{merchant?.business_name || "Biznis la"}</span> pase ak siksè! Klike anba a pou voye resi a dirèk bay vandè a.
        </p>

        <div className="bg-[#0d0e1a] border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 w-full max-w-sm space-y-4 mb-8 md:mb-10 shadow-2xl text-left">
          <div className="flex justify-between items-center text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5 pb-4 mb-2">
            <span>Vandè / Biznis</span>
            <div className="flex items-center gap-2">
              <img 
                src={merchant?.logo_url || merchant?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(merchant?.business_name || 'H-Pay')}&background=27272a&color=fff&bold=true`}
                alt="Logo" 
                className="w-5 h-5 rounded-md object-cover"
              />
              <span className="text-white font-bold italic truncate">{merchant?.business_name || "Biznis San Non"}</span>
            </div>
          </div>
          <div className="flex justify-between text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500">
            <span>Tranzaksyon ID</span>
            <span className="text-white">{txId}</span>
          </div>
          <div className="flex justify-between text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500 border-t border-white/5 pt-4">
            <span>Montan Peye</span>
            <span className="text-green-500 font-bold">{product?.price?.toLocaleString()} HTG</span>
          </div>
        </div>

        <button 
          onClick={() => window.open(whatsappLink, '_blank')}
          className="w-full max-w-sm bg-green-500 text-black py-5 md:py-6 rounded-full font-black uppercase text-[10px] md:text-[12px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_-15px_rgba(34,197,94,0.4)] flex items-center justify-center gap-3 animate-pulse"
        >
          <MessageCircle className="w-5 h-5 md:w-6 md:h-6" /> Voye Resi a sou WhatsApp
        </button>
      </div>
    );
  }

  // ==========================================
  // EKRAN PEMAN AN (PAJ PRINCIPAL CHECKOUT LA)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 sm:p-6 md:p-12 italic font-medium selection:bg-red-600">
      <div className="max-w-6xl mx-auto space-y-8 md:space-y-12">
        
        <button onClick={() => router.back()} className="flex items-center gap-2 md:gap-3 text-[10px] md:text-[12px] font-black uppercase text-zinc-500 hover:text-white transition-all tracking-[0.3em]">
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" /> ANILE ACHAT LA
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          
          <div className="lg:col-span-6 space-y-6 md:space-y-10 order-2 lg:order-1">
            
            <div className="space-y-2 md:space-y-4 text-center lg:text-left">
               <h1 className="text-4xl sm:text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.85]">Checkout <span className="text-red-600">Sekirize</span></h1>
            </div>

            {/* KAT BIZNIS MACHANN NAN */}
            <div className="bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[50px] rounded-full" />
               <div className="relative z-10 flex items-center gap-4 md:gap-6">
                 <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-black border-2 border-white/10 overflow-hidden shrink-0">
                   <img 
                     src={merchant?.logo_url || merchant?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(merchant?.business_name || 'H-Pay')}&background=27272a&color=fff&bold=true`}
                     alt="Business Logo" 
                     className="w-full h-full object-cover" 
                   />
                 </div>
                 <div className="flex-1">
                   <div className="flex items-center gap-2 text-green-500 mb-1">
                     <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4" />
                     <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Sètifye H-Pay</span>
                   </div>
                   <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter truncate">
                     {merchant?.business_name || "Biznis San Non"}
                   </h2>
                   
                   {product?.contact_phone && (
                     <div className="flex items-center gap-2 mt-3 text-zinc-400 bg-white/5 w-fit px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-white/5">
                       <Phone className="w-3 h-3 md:w-3.5 md:h-3.5 text-green-500" />
                       <span className="text-[10px] md:text-[11px] font-bold tracking-widest">{product.contact_phone}</span>
                     </div>
                   )}
                 </div>
               </div>
            </div>

            <div className="bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 space-y-6 md:space-y-8">
               <div className="flex items-start gap-4 md:gap-6">
                 <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl md:rounded-3xl bg-zinc-900 border border-white/5 overflow-hidden shrink-0 relative">
                   {product?.image_url ? (
                     <img src={product.image_url} className="w-full h-full object-cover" alt="Product" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-zinc-800"><Receipt className="w-8 h-8 md:w-10 md:h-10" /></div>
                   )}
                 </div>
                 <div className="flex-1 space-y-2">
                   <span className="text-[9px] md:text-[10px] text-red-500 font-black uppercase tracking-[0.3em]">{product?.category}</span>
                   <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-tight">{product?.title}</h3>
                   <p className="text-[10px] md:text-xs font-black uppercase text-zinc-500 bg-black/40 w-fit px-3 py-1 rounded-lg">Chak {product?.billing_cycle}</p>
                 </div>
               </div>

               <div className="pt-6 md:pt-8 border-t border-white/5 flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[9px] md:text-[10px] font-black text-zinc-600 uppercase tracking-widest">Total Pou Peye</p>
                  </div>
                  <div className="text-right flex items-end gap-2">
                    <p className="text-4xl md:text-5xl font-black italic tracking-tighter">{product?.price?.toLocaleString()}</p>
                    <p className="text-sm md:text-base text-red-600 font-black uppercase mb-1 md:mb-2">HTG</p>
                  </div>
               </div>
            </div>

            <div className="bg-red-600/5 border border-red-600/20 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] flex gap-4 items-start shadow-inner">
               <ShieldAlert className="w-5 h-5 md:w-6 md:h-6 text-red-600 shrink-0" />
               <p className="text-[10px] md:text-[11px] text-zinc-400 leading-relaxed font-bold italic">
                 <span className="text-white block mb-1 uppercase font-black">Garanti H-Pay Escrow</span>
                 Lajan ou an sekirite nèt. Li p ap ale sou kont vandè a toutotan ou pa konfime ou resevwa sèvis la kòrèkteman nan espas 24 èdtan.
               </p>
            </div>
          </div>

          <div className="lg:col-span-6 order-1 lg:order-2">
            <div className="bg-[#0d0e1a] p-6 sm:p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl relative">
              
              <div className="flex items-center justify-between mb-8 md:mb-10">
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter italic">Peye ak Kat</h3>
                <div className="flex gap-2">
                   <div className="w-8 h-5 bg-zinc-800 rounded flex items-center justify-center text-[6px] font-black italic">HatexCard</div>
                   <div className="w-8 h-5 bg-zinc-800 rounded flex items-center justify-center text-[6px] font-black italic"></div>
                </div>
              </div>

              <form onSubmit={handleProcessPayment} className="space-y-6 md:space-y-8">
                <div className="space-y-3">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Non sou Kat la</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="Jean Dupont"
                    className="w-full bg-black/40 border border-white/10 rounded-[2rem] p-5 md:p-6 text-sm font-bold uppercase outline-none focus:border-red-600 transition-all placeholder:text-zinc-700"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Nimewo Kat la</label>
                  <div className="relative">
                    <CreditCard className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4 md:w-5 md:h-5" />
                    <input 
                      required 
                      type="text" 
                      placeholder="0000 0000 0000 0000"
                      className="w-full bg-black/40 border border-white/10 rounded-[2rem] pl-14 md:pl-16 pr-6 py-5 md:py-6 text-base md:text-lg font-black tracking-[0.2em] outline-none focus:border-red-600 transition-all text-white placeholder:text-zinc-800"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-3">
                    <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Ekspire</label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4 md:w-5 md:h-5" />
                      <input 
                        required 
                        type="text" 
                        placeholder="MM/YY"
                        className="w-full bg-black/40 border border-white/10 rounded-[2rem] pl-12 md:pl-14 pr-4 py-5 md:py-6 text-sm md:text-base font-black tracking-widest outline-none focus:border-red-600 transition-all placeholder:text-zinc-800"
                        value={expiry}
                        onChange={handleExpiryChange}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] md:text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">CVV</label>
                    <div className="relative">
                      <Hash className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4 md:w-5 md:h-5" />
                      <input 
                        required 
                        type="password" 
                        maxLength={4}
                        placeholder="123"
                        className="w-full bg-black/40 border border-white/10 rounded-[2rem] pl-12 md:pl-14 pr-4 py-5 md:py-6 text-sm md:text-base font-black tracking-widest outline-none focus:border-red-600 transition-all placeholder:text-zinc-800"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-600/10 border border-red-600/20 p-4 md:p-5 rounded-2xl flex items-center gap-3 text-red-500">
                    <AlertCircle className="w-[18px] h-[18px] shrink-0" />
                    <span className="text-[9px] md:text-[10px] font-black uppercase italic tracking-widest leading-relaxed">{error}</span>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={processing}
                  className="w-full bg-red-600 py-6 md:py-8 rounded-[2rem] md:rounded-[3rem] font-black uppercase text-[12px] md:text-[14px] tracking-[0.4em] hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-red-600/20 flex items-center justify-center gap-3 md:gap-4 disabled:opacity-50 disabled:hover:scale-100 mt-4 md:mt-8"
                >
                  {processing ? <Loader2 className="animate-spin w-5 h-5 md:w-6 md:h-6" /> : <><Lock className="w-5 h-5 md:w-6 md:h-6" /> PEYE KOUNYE A</>}
                </button>

                <div className="flex flex-col items-center gap-2 md:gap-3 pt-4 md:pt-6 border-t border-white/5 mt-6">
                   <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                     <Lock className="w-3 h-3 text-green-600" /> SSL ENCRYPTED PAYMENT
                   </div>
                </div>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}