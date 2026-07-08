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

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isOwner, setIsOwner] = useState(false);

  const [cardInfo, setCardInfo] = useState({
    cardNumber: '',
    cardExpiry: '',
    cardCvv: ''
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    setCardInfo({ ...cardInfo, cardExpiry: value.substring(0, 5) });
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    const formatted = value.match(/.{1,4}/g)?.join(' ') || '';
    setCardInfo({ ...cardInfo, cardNumber: formatted.substring(0, 19) });
  };

  useEffect(() => {
    async function getInvoice() {
      setLoading(true);
      try {
        const res = await fetch(`/api/checkout-invoice/${id}/session`);
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setMessage({ type: 'error', text: data.message || 'Invoice sa a pa egziste nan sistèm nan.' });
          setLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.id === data.invoice.owner_id) {
          setIsOwner(true);
        }

        setInvoice({
          ...data.invoice,
          profiles: data.merchant,
        });
      } catch {
        setMessage({ type: 'error', text: 'Erè pandan chajman fakti a.' });
      } finally {
        setLoading(false);
      }
    }

    if (id) getInvoice();
  }, [id, supabase]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOwner || invoice?.status === 'paid') return;

    setPayLoading(true);
    setMessage({ type: '', text: '' });

    const cleanCardNumber = cardInfo.cardNumber.replace(/\s+/g, '');

    try {
      const response = await fetch(`/api/checkout-invoice/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_number: cleanCardNumber,
          card_cvv: cardInfo.cardCvv,
          card_expiry: cardInfo.cardExpiry,
        }),
      });

      const result = await response.json();

      if (result.success) {
        router.push(`/checkout-invoice/success?id=${id}`);
      } else {
        setMessage({ type: 'error', text: result.message || 'Peman an echwe.' });
      }
    } catch {
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

        <div className="absolute top-0 left-0 right-0 h-2 bg-indigo-600"></div>

        <div className="relative z-10">

          <div className="text-center mb-8 mt-2">
            <div className="relative w-20 h-20 mx-auto mb-4 group">
              {merchantLogo ? (
                <img
                  src={merchantLogo}
                  alt={merchantName}
                  className="w-full h-full rounded-2xl object-cover border-2 border-gray-100 shadow-sm"
                />
              ) : (
                <div className="w-full h-full rounded-2xl bg-indigo-50 flex items-center justify-center border-2 border-indigo-100">
                  <Store className="text-indigo-600" size={32} />
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{merchantName}</h2>
            <p className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1">
              <ShieldCheck size={12} className="text-emerald-500" /> Machann Verifye HatexCard
            </p>
          </div>

          {message.text && (
            <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{message.text}</span>
            </div>
          )}

          {!invoice ? (
            <div className="text-center py-8 text-slate-500">
              <Ban size={40} className="mx-auto mb-3 opacity-50" />
              <p>Fakti sa a pa disponib.</p>
            </div>
          ) : isOwner ? (
            <div className="text-center py-8 bg-amber-50 rounded-2xl border border-amber-100">
              <Info size={32} className="mx-auto mb-3 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">Ou pa ka peye pwòp fakti ou.</p>
              <p className="text-xs text-amber-600 mt-2">Voye lyen an bay kliyan ou.</p>
            </div>
          ) : invoice.status === 'paid' ? (
            <div className="text-center py-8 bg-emerald-50 rounded-2xl border border-emerald-100">
              <Receipt size={32} className="mx-auto mb-3 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">Fakti sa a deja peye.</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-50 rounded-2xl p-5 mb-6 border border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Montan</span>
                  <span className="text-2xl font-bold text-slate-900">{parseFloat(invoice.amount).toLocaleString()} <span className="text-sm font-medium text-slate-500">HTG</span></span>
                </div>
                {invoice.description && (
                  <p className="text-sm text-slate-600 border-t border-slate-200 pt-3">{invoice.description}</p>
                )}
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <User size={12} /> {invoice.client_email}
                </p>
              </div>

              <form onSubmit={handlePayment} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard size={16} className="text-indigo-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Kat HatexCard</span>
                  <Lock size={12} className="text-slate-400 ml-auto" />
                </div>

                <input
                  type="text"
                  placeholder="4550 XXXX XXXX XXXX"
                  value={cardInfo.cardNumber}
                  onChange={handleCardNumberChange}
                  className="w-full bg-white border border-gray-200 p-4 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none font-mono text-sm"
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="MM/YY"
                    value={cardInfo.cardExpiry}
                    onChange={handleExpiryChange}
                    className="w-full bg-white border border-gray-200 p-4 rounded-xl focus:border-indigo-500 outline-none font-mono text-sm"
                    required
                  />
                  <input
                    type="password"
                    placeholder="CVV"
                    value={cardInfo.cardCvv}
                    onChange={(e) => setCardInfo({ ...cardInfo, cardCvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    className="w-full bg-white border border-gray-200 p-4 rounded-xl focus:border-indigo-500 outline-none font-mono text-sm"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={payLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {payLoading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                  {payLoading ? 'Peman an ap trete...' : `Peye ${parseFloat(invoice.amount).toLocaleString()} HTG`}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
