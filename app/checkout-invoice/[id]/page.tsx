"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2, CreditCard, Receipt, Store, User, AlertCircle, ShieldCheck } from 'lucide-react';

export default function InvoiceCheckout() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [cardInfo, setCardInfo] = useState({
    cardNumber: '',
    cardExpiry: '',
    cardCvv: ''
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fonksyon pou fòmate dat MM/YY otomatikman
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Retire sa ki pa chif
    if (value.length > 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    setCardInfo({ ...cardInfo, cardExpiry: value.substring(0, 5) });
  };

  useEffect(() => {
    async function getInvoice() {
      // 1. Rale Invoice la
      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();
    
      if (invError || !invData) {
        setMessage({ type: 'error', text: 'Invoice sa a pa egziste.' });
        setLoading(false);
        return;
      }
    
      // 2. Rale pwofil machann nan ak owner_id (jan nou te wè nan SQL la)
      const { data: profData } = await supabase
        .from('profiles')
        .select('business_name, full_name, avatar_url')
        .eq('id', invData.owner_id) // Nou sèvi ak owner_id isit la
        .single();
    
      setInvoice({ ...invData, profiles: profData });
      setLoading(false);
    }
    if (id) getInvoice();
  }, [id, supabase]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
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
          card_expiry: cardInfo.cardExpiry // Sa ap voye l ak slach la (egz: 01/30)
        }),
      });
  
      const result = await response.json();
  
      if (result.success) {
        // Redireksyon sou paj siksè ki anndan folder checkout-invoice la
        router.push(`/checkout-invoice/success?id=${id}`);
      } else {
        setMessage({ type: 'error', text: result.message || 'Peman an echwe.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erè koneksyon ak tèminal peman an.' });
    } finally {
      setPayLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center italic text-red-500 font-black uppercase">
      <Loader2 className="animate-spin mr-3" size={24} /> Chaje Invoice la...
    </div>
  );

  const merchantName = invoice?.profiles?.business_name || invoice?.profiles?.full_name || "Boutik Machann";
  const merchantLogo = invoice?.profiles?.avatar_url;

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 flex items-center justify-center italic">
      <div className="w-full max-w-[500px] bg-[#0d0e1a] border border-white/5 rounded-[3rem] p-8 shadow-2xl relative">
        <div className="text-center mb-6">
          
          {/* Afichaj Logo ak Non Boutik */}
          <div className="relative w-24 h-24 mx-auto mb-4">
            {merchantLogo ? (
              <img 
                src={merchantLogo} 
                alt={merchantName} 
                className="w-full h-full rounded-[2rem] object-cover border-2 border-white/10 shadow-lg"
              />
            ) : (
              <div className="bg-red-600/10 w-full h-full rounded-[2rem] flex items-center justify-center border border-red-600/20 shadow-lg">
                <Store className="text-red-600 w-10 h-10" />
              </div>
            )}
          </div>

          <h1 className="text-2xl font-black uppercase tracking-tighter text-white">{merchantName}</h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Invoice #{invoice.id.split('-')[0]}</p>
        </div>

        <div className="bg-white/[0.03] p-6 rounded-[2rem] border border-white/5 text-center mb-6">
          <p className="text-[10px] text-zinc-500 font-black uppercase mb-1 tracking-widest">Montan pou Peye</p>
          <h2 className="text-4xl font-black text-white tracking-tighter">
            {invoice.amount.toLocaleString()} <span className="text-red-600 text-sm">HTG</span>
          </h2>
        </div>

        <div className="space-y-3 bg-white/[0.02] p-5 rounded-[1.5rem] border border-white/5 mb-6 text-[11px] font-bold">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 uppercase flex items-center gap-2"><Store size={14}/> Machann:</span>
            <span className="text-white">{merchantName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 uppercase flex items-center gap-2"><User size={14}/> Pou:</span>
            <span className="text-white">{invoice.client_email}</span>
          </div>
        </div>

        {invoice.status === 'paid' ? (
          <div className="bg-green-600/10 border border-green-600/20 p-6 rounded-[1.5rem] text-center cursor-pointer" onClick={() => router.push(`/checkout-invoice/success?id=${id}`)}>
            <ShieldCheck className="text-green-500 mx-auto mb-2" size={32} />
            <h3 className="text-green-500 font-black uppercase text-sm">Peman deja fèt. Klike pou wè resi a.</h3>
          </div>
        ) : (
          <form onSubmit={handlePayment} className="space-y-4">
            <div>
              <label className="block text-[10px] text-zinc-500 font-black uppercase mb-2 ml-2">Nimewo Kat</label>
              <input 
                type="text" 
                maxLength={19}
                className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-sm font-black text-white outline-none focus:border-red-600 transition-all shadow-inner"
                placeholder="0000 0000 0000 0000"
                value={cardInfo.cardNumber}
                onChange={(e) => setCardInfo({...cardInfo, cardNumber: e.target.value.replace(/[^\d ]/g, '')})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-zinc-500 font-black uppercase mb-2 ml-2">Dat Eksp. (MM/YY)</label>
                <input 
                  type="text" 
                  maxLength={5}
                  className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-sm font-black text-white outline-none focus:border-red-600 transition-all"
                  placeholder="MM/YY"
                  value={cardInfo.cardExpiry}
                  onChange={handleExpiryChange}
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-black uppercase mb-2 ml-2">CVV</label>
                <input 
                  type="password" 
                  maxLength={4}
                  className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-sm font-black text-white outline-none focus:border-red-600 transition-all tracking-widest"
                  placeholder="•••"
                  value={cardInfo.cardCvv}
                  onChange={(e) => setCardInfo({...cardInfo, cardCvv: e.target.value.replace(/\D/g, '')})}
                />
              </div>
            </div>

            {message.text && (
              <div className="p-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-3 bg-red-600/10 border border-red-600/20 text-red-500 animate-pulse">
                <AlertCircle size={16} /> {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={payLoading}
              className="w-full bg-white hover:bg-zinc-200 text-black py-5 rounded-[1.8rem] font-black text-xs uppercase transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4 shadow-xl active:scale-95"
            >
              {payLoading ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
              Peye {invoice.amount.toLocaleString()} HTG
            </button>
          </form>
        )}
      </div>
    </div>
  );
}