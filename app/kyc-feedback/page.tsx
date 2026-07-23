"use client";

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, MessageCircle, ShieldCheck, AlertTriangle } from 'lucide-react';
import { KYC_SURVEY_WHATSAPP_URL } from '@/lib/kyc/survey';

type Question = {
  id: string;
  label: string;
  type: 'single' | 'multi';
  options: { value: string; label: string }[];
};

function KycFeedbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('t') || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [fullName, setFullName] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [freeText, setFreeText] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError('Lyen an pa konplè. Itilize lyen ki nan email ou.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/kyc-feedback/session?t=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || 'Lyen an pa valab.');
          setLoading(false);
          return;
        }
        setFullName(data.full_name || 'Kliyan');
        setQuestions(data.questions || []);
        const init: Record<string, string | string[]> = {};
        (data.questions || []).forEach((q: Question) => {
          init[q.id] = q.type === 'multi' ? [] : '';
        });
        setAnswers(init);
      } catch {
        setError('Erè koneksyon.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const canSubmit = useMemo(() => {
    return questions.every((q) => {
      const v = answers[q.id];
      if (q.type === 'single') return typeof v === 'string' && v.length > 0;
      return Array.isArray(v) && v.length > 0;
    });
  }, [questions, answers]);

  const toggleMulti = (qid: string, value: string) => {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[qid]) ? [...(prev[qid] as string[])] : [];
      const idx = cur.indexOf(value);
      if (idx >= 0) cur.splice(idx, 1);
      else cur.push(value);
      return { ...prev, [qid]: cur };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/kyc-feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, answers, free_text: freeText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Soumisyon echwe.');
        return;
      }
      setDone(true);
    } catch {
      setError('Erè koneksyon.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      <div className="max-w-xl mx-auto px-4 pt-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Kesyonman KYC</h1>
            <p className="text-xs text-slate-500 font-medium">HatexCard · Edè nou konprann blokaj ou</p>
          </div>
        </div>

        {error && !done && (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl p-4 text-sm flex gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {done ? (
          <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm text-center">
            <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={40} />
            <h2 className="text-lg font-bold mb-2">Mèsi {fullName}!</h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Ekip sipò a pral li repons ou. Ou ka kontinye KYC oswa pale ak nou sou WhatsApp.
            </p>
            <div className="space-y-3">
              <a
                href={KYC_SURVEY_WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider"
              >
                <MessageCircle size={16} /> WhatsApp +509 3720 1241
              </a>
              <button
                type="button"
                onClick={() => router.push('/kyc')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider"
              >
                Ale nan KYC
              </button>
            </div>
          </div>
        ) : questions.length > 0 ? (
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-7">
            <p className="text-sm text-slate-600 leading-relaxed">
              Bonjou <strong>{fullName}</strong> — di nou sa k ap anpeche w pase KYC pou nou ka ede w.
            </p>

            {questions.map((q) => (
              <div key={q.id} className="space-y-3">
                <p className="text-sm font-bold text-slate-800">{q.label}</p>
                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const checked =
                      q.type === 'single'
                        ? answers[q.id] === opt.value
                        : Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type={q.type === 'single' ? 'radio' : 'checkbox'}
                          name={q.id}
                          checked={checked}
                          onChange={() => {
                            if (q.type === 'single') {
                              setAnswers((prev) => ({ ...prev, [q.id]: opt.value }));
                            } else {
                              toggleMulti(q.id, opt.value);
                            }
                          }}
                          className="mt-1"
                        />
                        <span className="text-sm text-slate-700">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">Kòmantè lib (opsyonèl)</label>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Di nou plis sou sa k ap bloke w..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Voye repons mwen
            </button>

            <a
              href={KYC_SURVEY_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-800 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider"
            >
              <MessageCircle size={16} /> Kontakte Sipò WhatsApp
            </a>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export default function KycFeedbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      }
    >
      <KycFeedbackInner />
    </Suspense>
  );
}
