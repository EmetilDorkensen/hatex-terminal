'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Store,
  XCircle,
} from 'lucide-react';

/**
 * Paj siksè inifye — pwodwi (/p/[ref]), API machann ak plugin WooCommerce.
 *
 * DB se sous verite a: nou pa janm montre "Peman reyisi!" si /api/checkout/summary
 * pa retounen status === 'paid'. Yon moun ki chanje URL a nan men navigatè a pa
 * ka fè paj la twonpe moun.
 *
 * Paj fakti (/checkout-invoice/success) rete apa — li gen resi detaye li.
 */

type Phase = 'checking' | 'success' | 'failed' | 'unknown';

type SummaryPayment = {
  purpose: string;
  description: string | null;
  client_total: number;
  merchant_order_id: string | null;
};

type Summary = {
  ok: boolean;
  status: string;
  paid_at: string | null;
  payment: SummaryPayment;
  merchant: { name: string } | null;
};

const POLL_ATTEMPTS = 8;
const POLL_DELAY_MS = 2000;

function purposeLabel(purpose: string | null | undefined): string {
  switch (purpose) {
    case 'product':
      return 'Pwodwi';
    case 'invoice':
      return 'Fakti';
    case 'plan_fee':
      return 'Abònman';
    case 'kyc_fee':
      return 'Frè KYC';
    case 'crypto_buy':
      return 'Achte kripto';
    default:
      return 'Peman machann';
  }
}

function formatHtg(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} HTG`;
}

function shortenRef(ref: string | null | undefined): string {
  if (!ref) return '';
  const s = String(ref);
  return s.length <= 22 ? s : `${s.slice(0, 10)}…${s.slice(-9)}`;
}

function SuccessCard() {
  const params = useSearchParams();
  const paymentId = (params.get('payment') || '').trim();
  const productRef = (params.get('p') || '').trim();
  const paramStatus = (params.get('status') || '').trim();

  const hasPayment = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    paymentId
  );

  const [phase, setPhase] = useState<Phase>(() => {
    if (paramStatus === 'failed') return 'failed';
    return hasPayment ? 'checking' : 'unknown';
  });
  const [summary, setSummary] = useState<Summary | null>(null);
  const attemptsRef = useRef(0);
  const stopRef = useRef(false);

  useEffect(() => {
    if (!hasPayment) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    stopRef.current = false;
    attemptsRef.current = 0;

    const tick = async () => {
      if (stopRef.current) return;
      attemptsRef.current += 1;

      try {
        const res = await fetch(
          `/api/checkout/summary?payment_id=${encodeURIComponent(paymentId)}`
        );
        if (!res.ok) throw new Error('summary unavailable');

        const data = (await res.json()) as Summary;
        if (!data.ok) throw new Error('summary not ok');

        setSummary(data);

        if (data.status === 'paid') {
          stopRef.current = true;
          setPhase('success');
          return;
        }

        if (data.status === 'failed' || data.status === 'cancelled' || data.status === 'expired') {
          stopRef.current = true;
          setPhase('failed');
          return;
        }
      } catch {
        // Re-eseye jiskaske nou fin ak POLL_ATTEMPTS
      }

      if (attemptsRef.current >= POLL_ATTEMPTS || stopRef.current) {
        stopRef.current = true;
        setPhase((prev) => (prev === 'checking' ? 'unknown' : prev));
        return;
      }

      timer = setTimeout(() => void tick(), POLL_DELAY_MS);
    };

    void tick();

    return () => {
      stopRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [hasPayment, paymentId]);

  const backHref = productRef ? `/p/${encodeURIComponent(productRef)}` : '/';
  const backLabel = productRef ? 'Tounen nan boutik' : 'Retounen akèy';

  return (
    <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl p-8 shadow-sm text-center">
      {phase === 'checking' && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={30} />
          </div>
          <h1 className="text-xl font-black tracking-tight mt-5">N ap verifye peman an…</h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Nou ap tcheke konfimasyon an sou baz done a. Sa ka pran kèk segond.
          </p>
        </>
      )}

      {phase === 'success' && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <CheckCircle2 className="text-emerald-500" size={34} />
          </div>
          <h1 className="text-xl font-black tracking-tight mt-5">Peman reyisi!</h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Mèsi. Peman ou an konfime epi machann nan resevwa yon notifikasyon.
          </p>

          {summary && (
            <div className="mt-6 text-left bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  Peman
                </span>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-1">
                  {purposeLabel(summary.payment.purpose)}
                </span>
              </div>

              <p className="text-3xl font-black tracking-tight">
                {typeof summary.payment.client_total === 'number'
                  ? formatHtg(summary.payment.client_total)
                  : '—'}
              </p>

              {summary.payment.description && (
                <p className="text-xs text-slate-600 leading-relaxed">
                  {summary.payment.description}
                </p>
              )}

              {summary.merchant?.name && (
                <div className="flex items-start gap-2 pt-1 border-t border-slate-200">
                  <Store size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-700 font-semibold">{summary.merchant.name}</p>
                </div>
              )}

              {summary.payment.merchant_order_id && (
                <p className="text-[11px] text-slate-400">
                  Referans: {shortenRef(summary.payment.merchant_order_id)}
                </p>
              )}
            </div>
          )}

          <Link
            href={backHref}
            className="mt-6 inline-flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all text-sm"
          >
            {backLabel}
            <ArrowRight size={16} />
          </Link>
        </>
      )}

      {phase === 'failed' && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
            <XCircle className="text-red-500" size={32} />
          </div>
          <h1 className="text-xl font-black tracking-tight mt-5">Peman an pa t konplete</h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Peman an te anile oswa li echwe sou MonCash. Ou ka eseye ankò si ou vle.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center gap-2 w-full bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 font-bold py-3.5 rounded-xl transition-all text-sm"
          >
            Retounen akèy
            <ArrowRight size={16} />
          </Link>
        </>
      )}

      {phase === 'unknown' && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
            <HelpCircle className="text-amber-500" size={32} />
          </div>
          <h1 className="text-xl font-black tracking-tight mt-5">Estati pa klè</h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Nou pa t kapab konfime peman an sou baz done a. Si ou fin peye, tcheke avèk
            machann nan oswa eseye ankò.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center gap-2 w-full bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 font-bold py-3.5 rounded-xl transition-all text-sm"
          >
            Retounen akèy
            <ArrowRight size={16} />
          </Link>
        </>
      )}

      <p className="text-[11px] text-slate-400 mt-6">
        HatexCard — konfimasyon peman MonCash sekirize
      </p>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl p-8 text-center">
            <div className="w-10 h-10 mx-auto border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <SuccessCard />
      </Suspense>
    </div>
  );
}
