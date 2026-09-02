"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, Receipt, Store, User,
  AlertCircle, ShieldCheck, Ban, Info, Smartphone, CreditCard
} from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import { MonCashPhonePay } from '@/components/payments/MonCashPhonePay';

type Quote = {
  currency: 'HTG' | 'USD';
  amountOriginal: number;
  amountHtg: number;
  usdRate: number | null;
  platformFee: number;
  payoutFee: number;
  clientTotal: number;
  receiveBlocked?: boolean;
  receiveMessage?: string | null;
  remainingHtg?: number | null;
  dailyLimitHtg?: number | null;
  paymentMethods: Array<{ id: string; label: string; available: boolean; soon?: boolean }>;
};

export default function InvoiceCheckout() {
  const { id } = useParams();

  const [invoice, setInvoice] = useState<any>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isOwner, setIsOwner] = useState(false);
  const [method, setMethod] = useState<'moncash' | 'natcash' | 'visa'>('moncash');

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

        // Sèvè a idantifye pwopriyetè a (cookie sesyon) — li pa janm voye owner_id.
        if (data.is_owner === true) {
          setIsOwner(true);
        }

        setInvoice({
          ...data.invoice,
          profiles: data.merchant,
        });

        if (data.quote) {
          setQuote(data.quote);
        } else {
          const qRes = await fetch(`/api/checkout-invoice/${id}/pay-moncash`);
          const qData = await qRes.json();
          if (qRes.ok && qData.quote) setQuote(qData.quote);
        }
      } catch {
        setMessage({ type: 'error', text: 'Erè pandan chajman fakti a.' });
      } finally {
        setLoading(false);
      }
    }

    if (id) getInvoice();
  }, [id]);

  const startPayment = async (phone: string) => {
    if (isOwner || invoice?.status === 'paid') {
      return { ok: false as const, message: 'Ou pa ka peye fakti sa a.' };
    }
    try {
      const response = await fetch(`/api/checkout-invoice/${id}/pay-moncash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_phone: phone, flow: 'auto' }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        return {
          ok: false as const,
          message: result.message || 'Pa t kapab kòmanse peman an.',
        };
      }
      return {
        ok: true as const,
        checkout_mode: (result.checkout_mode as 'hosted' | 'ussd') || 'hosted',
        checkout_url: result.checkout_url || null,
        payment_id: result.payment_id,
      };
    } catch {
      return { ok: false as const, message: 'Erè koneksyon. Tcheke entènèt ou.' };
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
  const currency = (invoice?.currency || quote?.currency || 'HTG') as string;
  const amount = Number(invoice?.amount || quote?.amountOriginal || 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 flex items-center justify-center font-sans">
      <div className="w-full max-w-[480px] bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">

        <div className="absolute top-0 left-0 right-0 h-2 bg-indigo-600"></div>

        <div className="relative z-10">

          <div className="text-center mb-8 mt-2">
            <div className="relative w-20 h-20 mx-auto mb-4 group">
              {merchantLogo ? (
                <SafeImg
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
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Montan fakti</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {amount.toLocaleString()}{' '}
                    <span className="text-sm font-medium text-slate-500">{currency}</span>
                  </span>
                </div>
                {invoice.description && (
                  <p className="text-sm text-slate-600 border-t border-slate-200 pt-3">{invoice.description}</p>
                )}
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <User size={12} /> {invoice.client_email}
                </p>
              </div>

              {quote?.receiveBlocked && (
                <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800">
                  <p className="font-bold">
                    {quote.receiveMessage || 'Kont machann nan pa elaji pou l resevwa lajan an.'}
                  </p>
                  <p className="text-xs mt-1 text-rose-700">
                    Machann nan rive sou limit jou li. Li dwe elaji kont li pou ka resevwa peman sa a.
                  </p>
                </div>
              )}

              {quote?.receiveBlocked ? null : (
              <>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Kijan ou vle peye?
              </p>
              <div className="space-y-2 mb-5">
                <button
                  type="button"
                  onClick={() => setMethod('moncash')}
                  className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 text-left transition-colors ${
                    method === 'moncash'
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <Smartphone size={18} className="text-indigo-600" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">MonCash</p>
                    <p className="text-[11px] text-slate-500">Peye an HTG (+ frè sèvis)</p>
                  </div>
                </button>
                <button
                  type="button"
                  disabled
                  className="w-full flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3 text-left opacity-50 cursor-not-allowed"
                >
                  <Smartphone size={18} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-600">Natcash</p>
                    <p className="text-[11px] text-slate-400">Talè</p>
                  </div>
                </button>
                <button
                  type="button"
                  disabled
                  className="w-full flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3 text-left opacity-50 cursor-not-allowed"
                >
                  <CreditCard size={18} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-600">Visa / Mastercard</p>
                    <p className="text-[11px] text-slate-400">Stripe — talè</p>
                  </div>
                </button>
              </div>

              {method === 'moncash' && quote && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-4 text-xs space-y-1.5">
                  {quote.currency === 'USD' && quote.usdRate && (
                    <div className="flex justify-between text-slate-600">
                      <span>To ({quote.amountOriginal} USD × {quote.usdRate})</span>
                      <span className="font-semibold">{quote.amountHtg.toLocaleString()} HTG</span>
                    </div>
                  )}
                  {quote.currency === 'HTG' && (
                    <div className="flex justify-between text-slate-600">
                      <span>Montan</span>
                      <span className="font-semibold">{quote.amountHtg.toLocaleString()} HTG</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Frè sèvis</span>
                    <span className="font-semibold">
                      {(quote.platformFee + quote.payoutFee).toLocaleString()} HTG
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-2 mt-1">
                    <span>Ou peye</span>
                    <span>{quote.clientTotal.toLocaleString()} HTG</span>
                  </div>
                </div>
              )}

              {method === 'moncash' && quote && !isOwner && invoice?.status !== 'paid' && (
                <>
                  <MonCashPhonePay
                    amount={quote.clientTotal}
                    blocked={quote.receiveBlocked === true}
                    startPayment={startPayment}
                  />
                  <p className="text-[10px] text-slate-400 text-center mt-3 leading-relaxed">
                    Peman fèt ak MonCash: nou voye yon USSD sou telefòn ou pou konfime ak PIN ou.
                    Apre konfimasyon, machann lan resevwa yon notifikasyon epi lajan an ale sou kont li.
                  </p>
                </>
              )}
              </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
