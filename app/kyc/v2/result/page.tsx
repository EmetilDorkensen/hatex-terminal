'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';

/**
 * Kote MonCash voye moun nan tounen apre li fin peye frè KYC a.
 *
 * Nou pa fè konfyans sa URL la di: nou mande sèvè a ki eta dosye a vrèman
 * genyen. Soumisyon an fèt bò kote sèvè lè peman an konfime.
 */

type Status = 'checking' | 'submitted' | 'pending' | 'failed';

function ResultContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>('checking');
  const [attempt, setAttempt] = useState(0);

  const declared = params.get('status');

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/api/kyc/v2/application');
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        const data = await res.json();
        const appStatus = data?.application?.status;

        if (cancelled) return;

        if (appStatus && appStatus !== 'draft') {
          setStatus('submitted');
          return;
        }

        // Alert MonCash la ka poko rive — nou reeseye plizyè fwa
        if (attempt < 5) {
          setTimeout(() => !cancelled && setAttempt((a) => a + 1), 2000);
          setStatus('checking');
        } else {
          setStatus(declared === 'failed' ? 'failed' : 'pending');
        }
      } catch {
        if (!cancelled) setStatus('pending');
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [attempt, declared, router]);

  const view = {
    checking: {
      icon: <Loader2 size={28} className="animate-spin" />,
      tone: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      title: 'N ap konfime peman ou',
      body: 'Tann yon ti moman — nou ap tcheke ak MonCash.',
      action: null as null | { label: string; href: string },
    },
    submitted: {
      icon: <CheckCircle2 size={28} />,
      tone: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      title: 'Peman konfime',
      body: 'Dosye ou soumèt. Ekip nou an ap revize l epi nou ap avize ou pa imèl.',
      action: { label: 'Ale nan Dashboard', href: '/dashboard' },
    },
    pending: {
      icon: <Clock size={28} />,
      tone: 'bg-amber-50 text-amber-600 border-amber-100',
      title: 'Peman an ap trete',
      body:
        'Nou poko resevwa konfimasyon MonCash la. Si ou te peye, dosye ou ap soumèt ' +
        'otomatikman nan kèk minit — ou pa bezwen peye ankò.',
      action: { label: 'Ale nan Dashboard', href: '/dashboard' },
    },
    failed: {
      icon: <XCircle size={28} />,
      tone: 'bg-red-50 text-red-600 border-red-100',
      title: 'Peman an pa pase',
      body: 'Pa gen anyen ki debite. Ou ka eseye peye ankò.',
      action: { label: 'Eseye ankò', href: '/kyc/v2' },
    },
  }[status];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex items-center">
      <div className="max-w-lg mx-auto w-full">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm text-center">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 border mx-auto ${view.tone}`}
          >
            {view.icon}
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">{view.title}</h1>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">{view.body}</p>

          {view.action && (
            <button
              type="button"
              onClick={() => router.push(view.action!.href)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs"
            >
              {view.action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KycV2ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 size={28} className="animate-spin text-indigo-600" />
        </div>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
