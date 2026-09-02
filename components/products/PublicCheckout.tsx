"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Store,
} from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import { MonCashPhonePay } from '@/components/payments/MonCashPhonePay';

type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  ref: string;
  description: string | null;
  image_url: string | null;
  price_htg: number;
};

type PublicQuote = {
  priceHtg: number;
  platformFee: number;
  payoutFee: number;
  clientTotal: number;
  receiveBlocked: boolean;
  receiveMessage: string | null;
};

export function PublicCheckout({
  product,
  merchant,
  quote,
  status,
}: {
  product: PublicProduct;
  merchant: { name: string; avatar_url: string | null };
  quote: PublicQuote | null;
  status: 'success' | 'cancel' | null;
}) {
  const startPayment = async (phone: string) => {
    try {
      const res = await fetch('/api/products/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          ref: product.ref,
          customer_phone: phone,
          flow: 'auto',
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
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

  const fees =
    quote && quote.clientTotal > 0
      ? Math.max(quote.clientTotal - quote.priceHtg, 0)
      : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header machann */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 overflow-hidden">
              {merchant.avatar_url ? (
                <SafeImg src={merchant.avatar_url} alt={merchant.name} className="w-full h-full object-cover" />
              ) : (
                <Store size={18} />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{merchant.name}</p>
              <p className="text-[11px] text-slate-500">Boutik sou HatexCard</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5 shrink-0">
            <ShieldCheck size={14} />
            Peman sekirize
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {status === 'success' && (
          <div className="bg-white border border-emerald-200 rounded-2xl p-6 mb-6 text-center">
            <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={44} />
            <h2 className="text-xl font-black tracking-tight">Peman reyisi!</h2>
            <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
              Mèsi. Machann lan resevwa yon notifikasyon pou pwodwi «{product.name}» epi li ap
              kontakte ou talè. Ou ka fèmen paj sa a.
            </p>
          </div>
        )}

        {status === 'cancel' && (
          <div className="bg-white border border-amber-200 rounded-2xl p-6 mb-6 text-center">
            <AlertTriangle className="mx-auto text-amber-500 mb-3" size={40} />
            <h2 className="text-xl font-black tracking-tight">Peman pa t fini</h2>
            <p className="text-sm text-slate-600 mt-2">
              Ou te anile peman an sou MonCash. Ou ka eseye ankò si ou vle.
            </p>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm md:grid md:grid-cols-2">
          {/* Foto pwodwi */}
          <div className="bg-slate-100 md:min-h-[420px] flex items-center justify-center">
            {product.image_url ? (
              <SafeImg
                src={product.image_url}
                alt={product.name}
                className="w-full h-64 md:h-full object-cover"
              />
            ) : (
              <span className="w-24 h-24 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-400 font-black text-3xl">
                {product.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Detay + peman */}
          <div className="p-5 lg:p-6 flex flex-col">
            <h1 className="text-xl lg:text-2xl font-black tracking-tight leading-tight">
              {product.name}
            </h1>
            <p className="text-3xl font-black mt-3">
              {Math.round(product.price_htg).toLocaleString('fr-FR')}{' '}
              <span className="text-base font-bold text-slate-500">HTG</span>
            </p>

            {product.description && (
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line mt-3">
                {product.description}
              </p>
            )}

            <div className="flex-1" />

            <div className="mt-6">
              {quote?.receiveBlocked && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mb-3 flex gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>
                    {quote.receiveMessage || 'Machann lan pa ka resevwa peman kounye a.'} Eseye ankò pita.
                  </span>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-4 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Pri pwodwi</span>
                  <span className="font-semibold">
                    {Math.round(product.price_htg).toLocaleString('fr-FR')} HTG
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Frè sèvis</span>
                  <span className="font-semibold">
                    {fees != null ? `${fees.toLocaleString('fr-FR')} HTG` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-2 mt-1">
                  <span>Ou peye</span>
                  <span>
                    {quote ? `${quote.clientTotal.toLocaleString('fr-FR')} HTG` : '…'}
                  </span>
                </div>
              </div>

              {quote && status !== 'success' && (
                <MonCashPhonePay
                  amount={quote.clientTotal}
                  blocked={!!quote.receiveBlocked}
                  startPayment={startPayment}
                  onPaid={(paymentId) => {
                    // DB konfime "paid" → paj siksè inifye (ki verifye DB ankò via payment id)
                    const qs = new URLSearchParams({ payment: paymentId, p: product.ref });
                    window.location.href = `/success?${qs.toString()}`;
                  }}
                />
              )}

              {quote && !quote.receiveBlocked && status !== 'success' && (
                <p className="text-[10px] text-slate-400 text-center mt-3 leading-relaxed">
                  Peman fèt ak MonCash: nou voye yon USSD sou telefòn ou pou konfime ak PIN ou.
                  Apre konfimasyon, machann lan resevwa yon notifikasyon epi lajan an ale sou kont li.
                </p>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-6">
          HatexCard — pasèl peman pou machann Ayisyen
        </p>
      </div>
    </div>
  );
}

