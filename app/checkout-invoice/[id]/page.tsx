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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans text-slate-900">
      <Loader2 className="animate-spin mb-4 text-indigo-600" size={40} />
      <span className="text-sm font-semibold text-slate-600 tracking-wide uppercase">Verifye Invoice...</span>
    </div>
  );

  const merchantName = invoice?.profiles?.business_name || invoice?.profiles?.full_name || "Boutik Machann";
  const merchantLogo = invoice?.profiles?.avatar_url;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 flex items-center justify-center font-sans">
      <div className="w-full max-w-[480px] bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        
        {/* Dekorasyon background anlè */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-indigo-600"></div>
        
        <div className="relative z-10">
          
          {/* Header Machann nan */}
          <div className="text-center mb-8 mt-2">
            <div className="relative w-20 h-20 mx-auto mb-4 group">
              {merchantLogo ? (
                <img 
                  src={merchantLogo} 
                  alt={merchantName} 
                  className="w-full h-full rounded-2xl object-cover border border-gray-200 shadow-sm transition-transform group-hover:scale-105 bg-white" 
                />
              ) : (
                <div className="bg-indigo-50 w-full h-full rounded-2xl flex items-center justify-center border border-indigo-100 shadow-sm">
                  <Store className="text-indigo-600 w-8 h-8" />
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-6 h-6 rounded-full border-[3px] border-white flex items-center justify-center">
                <ShieldCheck size={12} className="text-white" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{merchantName}</h1>
            <div className="flex items-center justify-center gap-2 mt-2">
               <span className="text-xs bg-slate-100 px-3 py-1 rounded-md text-slate-600 font-semibold uppercase tracking-wider border border-slate-200">
                 Invoice #{invoice.id.split('-')[0]}
               </span>
            </div>
          </div>

          {/* Bwat Montan an */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-gray-200 text-center mb-8 shadow-sm">
            <p className="text-xs text-slate-500 font-semibold uppercase mb-1 tracking-wider">Montan Total</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
              {invoice.amount.toLocaleString()} <span className="text-indigo-600 text-lg ml-1 font-bold">HTG</span>
            </h2>
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-center px-2 mb-4">
              <span className="text-slate-500 uppercase text-xs font-semibold flex items-center gap-2"><User size={16}/> Kliyan</span>
              <span className="text-slate-900 text-sm font-semibold">{invoice.client_email}</span>
            </div>
            <div className="h-[1px] bg-gray-200 w-full"></div>
          </div>

          {/* Sistèm Blokaj ak Fòm */}
          {isOwner ? (
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center shadow-sm">
              <Ban className="text-amber-500 mx-auto mb-3" size={40} />
              <h3 className="text-amber-700 font-bold uppercase text-xs mb-2 tracking-wider">Sistèm Sekirite</h3>
              <p className="text-sm text-amber-800 font-medium leading-relaxed px-2">
                Ou pa ka peye pwòp invoice ou. Tanpri voye lyen sa a bay kliyan an pou l fè peman an.
              </p>
            </div>
          ) : invoice.status === 'paid' ? (
            <div 
              className="bg-emerald-50 border border-emerald-200 p-8 rounded-2xl text-center cursor-pointer group hover:bg-emerald-100 transition-all shadow-sm"
              onClick={() => router.push(`/checkout-invoice/success?id=${id}`)}
            >
              <ShieldCheck className="text-emerald-500 mx-auto mb-3 group-hover:scale-110 transition-transform" size={48} />
              <h3 className="text-emerald-700 font-bold uppercase text-sm mb-1 tracking-wide">Peman Konfime</h3>
              <p className="text-xs text-emerald-600 font-semibold uppercase">Klike la a pou rale resi ou</p>
            </div>
          ) : (
            <form onSubmit={handlePayment} className="space-y-5">
              
              <div className="group">
                <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider flex items-center gap-2">
                  <CreditCard size={14} className="text-indigo-600" /> Nimewo Kat
                </label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  name="cc-number"
                  autoComplete="cc-number"
                  required
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-base font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-400 shadow-sm"
                  placeholder="0000 0000 0000 0000"
                  value={cardInfo.cardNumber}
                  onChange={handleCardNumberChange}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider flex items-center gap-2">
                    <Receipt size={14} className="text-indigo-600" /> Dat Eksp.
                  </label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    name="cc-exp"
                    autoComplete="cc-exp"
                    required
                    placeholder="MM/YY" 
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-base font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-center shadow-sm placeholder:text-gray-400" 
                    value={cardInfo.cardExpiry} 
                    onChange={handleExpiryChange} 
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider flex items-center gap-2">
                    <Lock size={14} className="text-indigo-600" /> CVV
                  </label>
                  <input 
                    type="password" 
                    inputMode="numeric"
                    name="cc-csc"
                    autoComplete="cc-csc"
                    required
                    maxLength={4}
                    placeholder="•••" 
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-base font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-center tracking-widest shadow-sm placeholder:text-gray-400" 
                    value={cardInfo.cardCvv} 
                    onChange={(e) => setCardInfo({...cardInfo, cardCvv: e.target.value.replace(/\D/g, '')})} 
                  />
                </div>
              </div>

              {message.text && (
                <div className="p-4 rounded-xl text-sm font-medium flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700">
                  <AlertCircle size={18} className="shrink-0" /> 
                  <span className="leading-tight">{message.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={payLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 mt-2 shadow-sm hover:shadow-md"
              >
                {payLoading ? (
                  <Loader2 className="animate-spin text-white" size={20} />
                ) : (
                  <>
                    <Lock size={16} /> 
                    <span>Peye {invoice.amount.toLocaleString()} HTG</span>
                  </>
                )}
              </button>
              
              <div className="mt-6 flex flex-col items-center gap-2">
                <p className="text-center text-xs text-slate-500 font-semibold flex items-center justify-center gap-1.5">
                  <ShieldCheck size={14} className="text-indigo-500" /> Peman an ankripte epi l an sekirite
                </p>
                <div className="flex items-center gap-1 opacity-50 mt-1">
                   <img src="https://i.imgur.com/xDk58Xk.png" alt="Logo" className="w-3 h-3 rounded-sm grayscale" />
                   <span className="text-[9px] uppercase tracking-widest font-bold text-slate-400">Hatexcard</span>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}