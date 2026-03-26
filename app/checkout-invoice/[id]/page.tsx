"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Loader2, CreditCard, Receipt, Store, User, 
  AlertCircle, ShieldCheck, Ban, Lock, Info 
} from 'lucide-react';

export default function InvoiceCheckout() {
  const { id } = useParams();
  const router = useRouter();
  
  // States pou jere done yo
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isOwner, setIsOwner] = useState(false);

  // States pou fòm nan
  const [cardInfo, setCardInfo] = useState({
    cardNumber: '',
    cardExpiry: '',
    cardCvv: ''
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Fonksyon pou fòmate Dat la MM/YY otomatikman
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); 
    if (value.length > 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    setCardInfo({ ...cardInfo, cardExpiry: value.substring(0, 5) });
  };

  // 2. Fonksyon pou fòmate nimewo kat la (ajoute espas chak 4 chif)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    let formatted = value.match(/.{1,4}/g)?.join(' ') || '';
    setCardInfo({ ...cardInfo, cardNumber: formatted.substring(0, 19) });
  };

  useEffect(() => {
    async function getInvoice() {
      setLoading(true);
      
      // Rale Invoice la ak tout detay
      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();
    
      if (invError || !invData) {
        setMessage({ type: 'error', text: 'Invoice sa a pa egziste nan sistèm nan.' });
        setLoading(false);
        return;
      }

      // SEKIRITE: Tcheke si se machann nan k ap gade pwòp invoice li
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === invData.owner_id) {
        setIsOwner(true);
      }
    
      // Rale pwofil machann nan (owner_id)
      const { data: profData } = await supabase
        .from('profiles')
        .select('business_name, full_name, avatar_url, kyc_status')
        .eq('id', invData.owner_id)
        .single();
    
      setInvoice({ ...invData, profiles: profData });
      setLoading(false);
    }

    if (id) getInvoice();
  }, [id, supabase]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOwner || invoice.status === 'paid') return;

    setPayLoading(true);
    setMessage({ type: '', text: '' });
  
    const cleanCardNumber = cardInfo.cardNumber.replace(/\s+/g, '');
  
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/pay-invoice`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          invoice_id: id,
          card_number: cleanCardNumber,
          card_cvv: cardInfo.cardCvv,
          card_expiry: cardInfo.cardExpiry
        }),
      });
  
      const result = await response.json();
  
      if (result.success) {
        router.push(`/checkout-invoice/success?id=${id}`);
      } else {
        setMessage({ type: 'error', text: result.message || 'Peman an echwe.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erè koneksyon ak tèminal peman an. Tcheke entènèt ou.' });
    } finally {
      setPayLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex flex-col items-center justify-center italic text-white font-black uppercase tracking-widest">
      <Loader2 className="animate-spin mb-4 text-red-600" size={48} />
      <span>Verifye Invoice...</span>
    </div>
  );

  const merchantName = invoice?.profiles?.business_name || invoice?.profiles?.full_name || "Boutik Machann";
  const merchantLogo = invoice?.profiles?.avatar_url;

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 flex items-center justify-center italic font-medium">
      <div className="w-full max-w-[480px] bg-[#0d0e1a] border border-white/5 rounded-[3.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
        
        {/* Dekorasyon background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/10 blur-[100px] rounded-full"></div>
        
        <div className="relative z-10">
          <div className="text-center mb-8">
            <div className="relative w-24 h-24 mx-auto mb-4 group">
              {merchantLogo ? (
                <img 
                  src={merchantLogo} 
                  alt={merchantName} 
                  className="w-full h-full rounded-[2.2rem] object-cover border-2 border-white/10 shadow-2xl transition-transform group-hover:scale-105" 
                />
              ) : (
                <div className="bg-gradient-to-br from-red-600/20 to-red-900/40 w-full h-full rounded-[2.2rem] flex items-center justify-center border border-white/5 shadow-lg">
                  <Store className="text-red-600 w-10 h-10" />
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-[#0d0e1a] flex items-center justify-center">
                <ShieldCheck size={12} className="text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-white leading-none">{merchantName}</h1>
            <div className="flex items-center justify-center gap-2 mt-2">
               <span className="text-[9px] bg-white/5 px-2 py-1 rounded-full text-zinc-500 font-black uppercase tracking-widest">
                 Invoice #{invoice.id.split('-')[0]}
               </span>
            </div>
          </div>

          <div className="bg-gradient-to-b from-white/[0.04] to-transparent p-7 rounded-[2.5rem] border border-white/5 text-center mb-8">
            <p className="text-[10px] text-zinc-500 font-black uppercase mb-1 tracking-[0.2em]">Montan Total</p>
            <h2 className="text-5xl font-black text-white tracking-tighter">
              {invoice.amount.toLocaleString()} <span className="text-red-600 text-lg ml-1 font-black">HTG</span>
            </h2>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center px-2">
              <span className="text-zinc-500 uppercase text-[10px] font-black flex items-center gap-2"><User size={14}/> Kliyan</span>
              <span className="text-white text-xs font-bold">{invoice.client_email}</span>
            </div>
            <div className="h-[1px] bg-white/5 w-full"></div>
          </div>

          {/* Sistèm Blokaj ak Fòm */}
          {isOwner ? (
            <div className="bg-orange-600/10 border border-orange-600/20 p-7 rounded-[2.5rem] text-center animate-in fade-in zoom-in duration-300">
              <Ban className="text-orange-500 mx-auto mb-3" size={44} />
              <h3 className="text-orange-500 font-black uppercase text-xs mb-2 tracking-widest">Sistèm Sekirite</h3>
              <p className="text-[11px] text-zinc-400 font-bold leading-relaxed px-4">
                Ou pa ka peye pwòp invoice ou. Tanpri voye lyen sa a bay kliyan an pou l fè peman an.
              </p>
            </div>
          ) : invoice.status === 'paid' ? (
            <div 
              className="bg-green-600/10 border border-green-600/20 p-8 rounded-[2.5rem] text-center cursor-pointer group hover:bg-green-600/20 transition-all shadow-lg shadow-green-900/10"
              onClick={() => router.push(`/checkout-invoice/success?id=${id}`)}
            >
              <ShieldCheck className="text-green-500 mx-auto mb-3 animate-bounce" size={48} />
              <h3 className="text-green-500 font-black uppercase text-sm mb-1 tracking-tighter">Peman Konfime</h3>
              <p className="text-[10px] text-zinc-400 font-bold uppercase">Klike la a pou rale resi ou</p>
            </div>
          ) : (
            <form onSubmit={handlePayment} className="space-y-5">
              <div className="group">
                <label className="block text-[10px] text-zinc-500 font-black uppercase mb-2 ml-4 tracking-widest flex items-center gap-2">
                  <CreditCard size={12}/> Nimewo Kat
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-[1.8rem] px-6 py-5 text-sm font-black text-white outline-none focus:border-red-600 focus:ring-4 focus:ring-red-600/10 transition-all placeholder:text-zinc-700 shadow-inner"
                  placeholder="0000 0000 0000 0000"
                  value={cardInfo.cardNumber}
                  onChange={handleCardNumberChange}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-black uppercase mb-2 ml-4 tracking-widest">Dat Eksp.</label>
                  <input 
                    type="text" 
                    required
                    placeholder="MM/YY" 
                    className="w-full bg-black/40 border border-white/10 rounded-[1.8rem] px-6 py-5 text-sm font-black text-white outline-none focus:border-red-600 transition-all text-center" 
                    value={cardInfo.cardExpiry} 
                    onChange={handleExpiryChange} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-black uppercase mb-2 ml-4 tracking-widest">CVV</label>
                  <input 
                    type="password" 
                    required
                    maxLength={4}
                    placeholder="•••" 
                    className="w-full bg-black/40 border border-white/10 rounded-[1.8rem] px-6 py-5 text-sm font-black text-white outline-none focus:border-red-600 transition-all text-center tracking-[0.5em]" 
                    value={cardInfo.cardCvv} 
                    onChange={(e) => setCardInfo({...cardInfo, cardCvv: e.target.value.replace(/\D/g, '')})} 
                  />
                </div>
              </div>

              {message.text && (
                <div className="p-5 rounded-[1.8rem] text-[10px] font-black uppercase flex items-center gap-3 bg-red-600/10 border border-red-600/20 text-red-500 animate-in slide-in-from-bottom-2 duration-300">
                  <AlertCircle size={18} className="shrink-0" /> 
                  <span className="leading-tight">{message.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={payLoading}
                className="w-full bg-white hover:bg-zinc-200 text-black py-6 rounded-[2.2rem] font-black text-[13px] uppercase tracking-tighter transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4 shadow-[0_15px_30px_rgba(255,255,255,0.1)] active:scale-95"
              >
                {payLoading ? (
                  <Loader2 className="animate-spin text-red-600" size={20} />
                ) : (
                  <>
                    <Lock size={16} /> 
                    <span>Peye {invoice.amount.toLocaleString()} HTG</span>
                  </>
                )}
              </button>
              
              <p className="text-center text-[9px] text-zinc-600 font-bold uppercase mt-4 flex items-center justify-center gap-2 italic">
                <ShieldCheck size={12} /> Sekirize pa H-Pay Encryption
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}