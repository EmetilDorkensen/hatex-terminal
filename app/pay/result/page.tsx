'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle, HelpCircle } from 'lucide-react';

type Status = 'success' | 'failed' | 'unknown';

const VIEWS: Record<
  Status,
  { title: string; message: string; tone: string; icon: typeof CheckCircle2 }
> = {
  success: {
    title: 'Peman reyisi',
    message:
      'Mèsi! Peman ou an konfime. Machann nan ap resevwa lajan an sou kont MonCash li.',
    tone: 'text-emerald-600',
    icon: CheckCircle2,
  },
  failed: {
    title: 'Peman pa pase',
    message:
      'Rechaje kont MonCash ou pou ou ka finalize peman an, epi eseye ankò. Si lajan an te soti sou kont ou, kontakte sipò — pa gen anyen ki pèdi.',
    tone: 'text-rose-600',
    icon: XCircle,
  },
  unknown: {
    title: 'Estati pa klè',
    message:
      'Nou pa jwenn ase enfòmasyon sou peman sa a. Tcheke istorik MonCash ou oswa kontakte sipò.',
    tone: 'text-amber-600',
    icon: HelpCircle,
  },
};

/**
 * Paj rezilta peman. Nou pa janm fè konfyans sèl paramèt navigatè a:
 * lè nou gen ID peman an, nou verifye ESTATI A NAN BAZ DONE (DB) — epi sèlman
 * si DB di 'paid', nou montre "Peman reyisi".
 */
function ResultCard() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('payment')?.trim() || undefined;

  const raw = searchParams.get('status');
  const paramStatus: Status = raw === 'success' ? 'success' : raw === 'failed' ? 'failed' : 'unknown';

  const [status, setStatus] = useState<Status>(paramStatus);
  const [checking, setChecking] = useState(false);
  const checkedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!paymentId || checkedRef.current) return;
    checkedRef.current = true;

    let cancelled = false;
    let tries = 0;
    const MAX_TRIES = 6;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const schedule = (ms: number) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => void tick(), ms);
    };

    const tick = async () => {
      if (cancelled) return;
      tries += 1;
      try {
        const res = await fetch(
          `/api/checkout/status?payment_id=${encodeURIComponent(paymentId)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.status === 'paid') {
            if (!cancelled) {
              clearTimer();
              setStatus('success');
              setChecking(false);
            }
            return;
          }
          if (data?.status === 'failed' || data?.status === 'cancelled') {
            if (!cancelled) {
              clearTimer();
              setStatus('failed');
              setChecking(false);
            }
            return;
          }
        }
      } catch {
        // rete nan tcheke / paramèt
      }

      if (cancelled) return;
      if (tries >= MAX_TRIES) {
        clearTimer();
        setChecking(false);
        // DB pa janm konfime — pa deklare siksè sou fòs paramèt navigatè a
        if (status === 'success') setStatus('unknown');
        return;
      }
      schedule(2000);
    };

    setChecking(true);
    schedule(300);
    return () => {
      cancelled = true;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  const showVerifying = checking && status !== 'failed';
  const view = VIEWS[status];
  const Icon = showVerifying ? Loader2 : view.icon;

  return (
    <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-gray-200 shadow-xl text-center">
      <Icon
        className={`w-14 h-14 mx-auto mb-5 ${showVerifying ? 'animate-spin text-indigo-600' : view.tone}`}
      />
      <h1 className="text-xl font-bold text-slate-900 mb-2">
        {showVerifying ? 'N ap verifye peman an...' : view.title}
      </h1>
      <p className="text-sm text-slate-600 leading-relaxed">
        {showVerifying
          ? 'Nou ap tcheke baz done a ak MonCash. Sa ka pran kèk segond.'
          : view.message}
      </p>

      {paymentId && (
        <p className="mt-5 text-[11px] font-mono text-slate-400 break-all">
          Referans: {paymentId}
        </p>
      )}

      <Link
        href="/"
        className="inline-block mt-8 px-6 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors"
      >
        Retounen
      </Link>
    </div>
  );
}

export default function PayResultPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Suspense fallback={<div className="w-full max-w-md" />}>
        <ResultCard />
      </Suspense>
    </div>
  );
}
