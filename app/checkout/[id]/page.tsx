"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { MonCashPhonePay } from '@/components/payments/MonCashPhonePay';

/**
 * Paj checkout HatexCard-hosted pou peman API (pasrèl v2).
 *
 * Machann yo voye kliyan yo sou /checkout/<payment_id> (se `checkout_url`
 * API a retounen). Kliyan an peye MENM JAN ak pwodwi/fakti:
 *   1. Li antre nimewo MonCash li.
 *   2. Li konfime ak PIN li sou telefòn li (USSD / paj MonCash nan yon lòt onglet).
 *   3. Paj sa a swiv estati a otomatikman — OKENN redireksyon sou lòt sit.
 * Lè peman an konfime, machann lan resevwa webhook + imèl.
 */

type Session = {
  id: string;
  mode: 'test' | 'live';
  status: string;
  amount: number;
  currency: string;
  description: string | null;
  merchant_name: string;
  checkout_mode: 'hosted' | 'ussd';
  moncash_url: string | null;
  return_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
};

export default function GatewayCheckoutPage() {
  const params = useParams<{ id: string }>();
  const paymentId = typeof params?.id === 'string' ? params.id : '';

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState('');
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!paymentId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/checkout/session?payment_id=${encodeURIComponent(paymentId)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setLoadError(data?.message || 'Peman pa jwenn.');
        } else {
          setSession(data.payment as Session);
          if (data.payment.status === 'paid') setPaid(true);
        }
      } catch {
        if (!cancelled) setLoadError('Erè koneksyon. Eseye ankò.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  const amountLabel = session
    ? `${Math.round(session.amount).toLocaleString('fr-FR')} HTG`
    : '';

  const goBackToMerchant = () => {
    if (!session?.return_url) return;
    try {
      const u = new URL(session.return_url);
      u.searchParams.set('payment_id', session.id);
      u.searchParams.set('status', 'paid');
      window.location.href = u.toString();
    } catch {
      window.location.href = session.return_url;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
            H
          </div>
          <span className="font-black text-slate-900 text-lg">HatexCard</span>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl shadow-xl shadow-indigo-100/50 p-6">
          {loading && (
            <div className="py-12 text-center">
              <Loader2 className="animate-spin mx-auto text-indigo-500 mb-3" size={32} />
              <p className="text-sm text-slate-500">Ap chaje peman an…</p>
            </div>
          )}

          {!loading && loadError && (
            <div className="py-8 text-center">
              <AlertTriangle className="mx-auto text-red-500 mb-3" size={40} />
              <h1 className="text-base font-black text-red-700">Peman pa jwenn</h1>
              <p className="text-xs text-red-600 mt-2">{loadError}</p>
            </div>
          )}

          {!loading && session && (
            <>
              <div className="text-center mb-5">
                {session.mode === 'test' && (
                  <span className="inline-block mb-2 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black tracking-wide uppercase">
                    Mòd tès — pa gen lajan reyèl
                  </span>
                )}
                <p className="text-xs text-slate-500 font-semibold">
                  Peman pou <span className="text-slate-900">{session.merchant_name}</span>
                </p>
                <p className="text-3xl font-black text-slate-900 mt-1">{amountLabel}</p>
                {session.description && (
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {session.description}
                  </p>
                )}
              </div>

              {paid || session.status === 'paid' ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                  <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={44} />
                  <h2 className="text-lg font-black text-emerald-800">Peman reyisi!</h2>
                  <p className="text-xs text-emerald-700 mt-2 leading-relaxed">
                    Mèsi — {amountLabel} peye bay {session.merchant_name}. Ou ka fèmen paj sa a.
                  </p>
                  {session.return_url && (
                    <button
                      type="button"
                      onClick={goBackToMerchant}
                      className="mt-4 px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-all"
                    >
                      Retounen sou sit machann lan
                    </button>
                  )}
                </div>
              ) : session.status === 'expired' ||
                session.status === 'cancelled' ||
                session.status === 'failed' ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
                  <AlertTriangle className="mx-auto text-red-500 mb-3" size={40} />
                  <h2 className="text-base font-black text-red-700">
                    {session.status === 'expired'
                      ? 'Lyen peman an ekspire'
                      : 'Peman an pa disponib ankò'}
                  </h2>
                  <p className="text-xs text-red-600 mt-2 leading-relaxed">
                    Retounen sou sit machann lan epi rekòmanse peman an pou w jwenn yon nouvo
                    lyen.
                  </p>
                </div>
              ) : (
                <MonCashPhonePay
                  amount={session.amount}
                  startPayment={async () => ({
                    ok: true,
                    checkout_mode: session.checkout_mode,
                    checkout_url: session.moncash_url,
                    payment_id: session.id,
                  })}
                  onPaid={() => setPaid(true)}
                />
              )}
            </>
          )}
        </div>

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mt-4">
          <ShieldCheck size={13} />
          Peman sekirize pa HatexCard — patnè ofisyèl MonCash
        </p>
      </div>
    </div>
  );
}
