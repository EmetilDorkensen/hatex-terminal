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

  useEffect(() => {
    async function getInvoice() {
      // NOUVO: Nou ajoute "avatar_url" nan demann lan
      const { data, error } = await supabase
        .from('invoices')
        .select('*, profiles(business_name, full_name, avatar_url)')
        .eq('id', id)
        .single();

      if (error || !data) {
        setMessage({ type: 'error', text: 'Enfòmasyon sa a pa egziste.' });
      } else {
        setInvoice(data);
      }
      setLoading(false);
    }
    getInvoice();
  }, [id, supabase]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayLoading(true);
    setMessage({ type: '', text: '' });

    if (!cardInfo.cardNumber || !cardInfo.cardExpiry || !cardInfo.cardCvv) {
      setMessage({ type: 'error', text: 'Tanpri ranpli tout enfòmasyon kat la.' });
      setPayLoading(false);
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/pay-invoice`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          invoice_id: id,
          card_number: cardInfo.cardNumber,
          card_cvv: cardInfo.cardCvv,
          card_expiry: cardInfo.cardExpiry
        }),
      });

      const result = await response.json();

      if (result.success) {
        router.push(`/success?id=${result.transaction_id}&type=invoice`);
      } else {
        setMessage({ type: 'error', text: result.message || 'Peman an echwe.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erè koneksyon ak rezo a.' });
    } finally {
      setPayLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center italic text-red-500 font-black uppercase">
      <Loader2 className="animate-spin mr-3" size={24} /> Chaje Invoice la...
    </div>
  );

  if (!invoice) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center text-white p-4">
      <div className="bg-[#0d0e1a] p-8 rounded-[2rem] border border-white/5 text-center">
        <AlertCircle className="text-red-500 mx-auto mb-4 w-12 h-12" />
        <p className="font-black italic uppercase text-lg text-zinc-400">{message.text || 'Invoice pa jwenn'}</p>
      </div>
    </div>
  );

  const merchantName = invoice.profiles?.business_name || invoice.profiles?.full_name;
  const merchantLogo = invoice.profiles?.avatar_url;

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 flex items-center justify-center italic">
      <div className="w-full max-w-[500px] bg-[#0d0e1a] border border-white/5 rounded-[3rem] p-8 shadow-2xl relative">
        <div className="text-center mb-6">
          
          {/* NOUVO: Afichaj Logo Machann nan oswa ikon default la si l pa gen logo */}
          {merchantLogo ? (
            <img 
              src={merchantLogo} 
              alt={merchantName} 
              className="w-20 h-20 rounded-3xl object-cover mx-auto mb-4 border-2 border-white/10 shadow-lg"
            />
          ) : (
            <div className="bg-red-600/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-red-600/20 shadow-lg">
              <Receipt className="text-red-600 w-10 h-10" />
            </div>
          )}

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
          <div className="bg-green-600/10 border border-green-600/20 p-6 rounded-[1.5rem] text-center">
            <ShieldCheck className="text-green-500 mx-auto mb-2" size={32} />
            <h3 className="text-green-500 font-black uppercase text-sm">Invoice sa a te deja peye</h3>
          </div>
        ) : (
          <form onSubmit={handlePayment} className="space-y-4">
            <div>
              <label className="block text-[10px] text-zinc-500 font-black uppercase mb-2">Nimewo Kat</label>
              <input 
                type="text" 
                maxLength={19}
                className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-sm font-black text-white outline-none focus:border-red-600 transition-all"
                placeholder="0000 0000 0000 0000"
                value={cardInfo.cardNumber}
                onChange={(e) => setCardInfo({...cardInfo, cardNumber: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-zinc-500 font-black uppercase mb-2">Dat Eksp. (MM/YY)</label>
                <input 
                  type="text" 
                  maxLength={5}
                  className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-sm font-black text-white outline-none focus:border-red-600 transition-all"
                  placeholder="12/26"
                  value={cardInfo.cardExpiry}
                  onChange={(e) => setCardInfo({...cardInfo, cardExpiry: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-black uppercase mb-2">CVV</label>
                <input 
                  type="password" 
                  maxLength={4}
                  className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-sm font-black text-white outline-none focus:border-red-600 transition-all tracking-widest"
                  placeholder="•••"
                  value={cardInfo.cardCvv}
                  onChange={(e) => setCardInfo({...cardInfo, cardCvv: e.target.value})}
                />
              </div>
            </div>

            {message.text && (
              <div className="p-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-3 bg-red-600/10 border border-red-600/20 text-red-500">
                <AlertCircle size={16} /> {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={payLoading}
              className="w-full bg-white hover:bg-zinc-200 text-black py-5 rounded-[1.8rem] font-black text-xs uppercase transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
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