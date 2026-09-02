'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { PLANS, type PlanId } from '@/lib/billing/plans';

type BillingState = {
  profile: {
    plan: string | null;
    plan_status: string;
    plan_period_end: string | null;
    intended_plan: string | null;
    kyc_status: string | null;
    effective_plan: string;
  };
  usage: {
    ok: boolean;
    used: number;
    remaining: number | null;
    limit: number | null;
    plan: string;
  };
  needs_plan: boolean;
};

export default function PlanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600" size={36} />
        </div>
      }
    >
      <PlanPageInner />
    </Suspense>
  );
}

function PlanPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<BillingState | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/billing/plan');
    if (res.status === 401) {
      router.replace('/login');
      return;
    }
    const data = await res.json();
    setState(data);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (search.get('paid') === '1' || search.get('status') === 'success') {
      void fetch('/api/billing/confirm', { method: 'POST' }).then(() => load());
    }
  }, [search, load]);

  const pick = async (plan: PlanId) => {
    setError(null);
    setBusy(plan);
    try {
      const res = await fetch('/api/billing/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || 'Pa t kapab chwazi plan an.');
        return;
      }
      if (data.next === 'kyc') {
        router.push('/kyc/v2');
        return;
      }
      if (data.next === 'pay') {
        const pay = await fetch('/api/billing/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        });
        const payData = await pay.json();
        if (!pay.ok || !payData.checkout_url) {
          setError(payData?.error?.message || 'Pa t kapab ouvri MonCash pou abonnman an.');
          return;
        }
        window.location.href = payData.checkout_url;
        return;
      }
      router.push('/dashboard');
    } catch {
      setError('Pwoblèm rezo.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
      </div>
    );
  }

  const current = state?.profile.effective_plan;
  const paidOk = search.get('status') === 'success' || search.get('paid') === '1';
  const payFailed = search.get('status') === 'failed';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      <div className="max-w-5xl mx-auto px-4 pt-10">
        <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
          Premye koneksyon
        </p>
        <h1 className="text-3xl font-black tracking-tight mb-2">Chwazi kijan ou vle itilize HatexCard</h1>
        <p className="text-sm text-slate-600 max-w-2xl mb-8 leading-relaxed">
          Ou gen aksè ak tout zouti yo (API, fakti, lyen, vann sèvis). Limit la se sou{' '}
          <strong>tout kòb ou resevwa</strong> nan yon jou — tout chanèl yo pataje menm kota a.
        </p>

        {paidOk && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-800 font-medium">
            Peman abonnman an trete. Si plan ou poko parèt, tann kèk segonn epi rafrechi.
          </div>
        )}

        {payFailed && (
          <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-800 font-medium leading-relaxed">
            Peman an pa t pase. Rechaje kont MonCash ou pou ou ka finalize peman abonnman an,
            epi klike Peye ankò.
          </div>
        )}

        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {(Object.keys(PLANS) as PlanId[]).map((id) => (
            <PlanCard
              key={id}
              id={id}
              selected={current === id && state?.profile.plan_status === 'active'}
              busy={busy}
              onPick={pick}
            />
          ))}
        </div>

        {state?.profile.plan && (
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="mt-8 mx-auto block text-sm font-semibold text-indigo-600"
          >
            Retounen nan dashboard
          </button>
        )}
      </div>
    </div>
  );
}

function planIcon(id: PlanId) {
  if (id === 'premium') return Sparkles;
  if (id === 'capacity') return Zap;
  return ShieldCheck;
}

function planButtonClass(id: PlanId, selected: boolean): string {
  if (selected) return 'bg-slate-100 text-slate-500';
  if (id === 'free') return 'bg-slate-900 text-white hover:bg-slate-800';
  return 'bg-indigo-600 text-white hover:bg-indigo-700';
}

function planCta(id: PlanId, selected: boolean, isBusy: boolean, price: number) {
  if (isBusy) return <Loader2 size={16} className="animate-spin" />;
  if (selected) return 'Plan aktif';
  if (id === 'free') return 'Itilize gratis';
  return `Peye ${price} HTG`;
}

function planLimitLabel(dailyLimitHtg: number | null): string {
  if (dailyLimitHtg == null) return 'San limit jou';
  return `${dailyLimitHtg.toLocaleString('fr-FR')} HTG / jou`;
}

function PlanCard({
  id,
  selected,
  busy,
  onPick,
}: Readonly<{
  id: PlanId;
  selected: boolean;
  busy: PlanId | null;
  onPick: (id: PlanId) => void;
}>) {
  const p = PLANS[id];
  const Icon = planIcon(id);
  const highlighted = id === 'capacity';
  return (
    <div
      className={`bg-white rounded-3xl border p-6 flex flex-col ${
        highlighted ? 'border-indigo-500 shadow-lg shadow-indigo-100' : 'border-gray-200'
      }`}
    >
      <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
        <Icon size={22} />
      </div>
      <h2 className="text-xl font-black">{p.name}</h2>
      <p className="text-xs text-slate-500 mt-1 mb-4">{p.tagline}</p>
      <p className="text-3xl font-black mb-1">
        {p.monthlyPriceHtg === 0 ? '0' : p.monthlyPriceHtg.toLocaleString('fr-FR')}
        <span className="text-sm font-semibold text-slate-500 ml-1">
          {p.monthlyPriceHtg === 0 ? 'HTG' : 'HTG/mwa'}
        </span>
      </p>
      <p className="text-sm font-bold text-indigo-700 mb-4">{planLimitLabel(p.dailyLimitHtg)}</p>
      <ul className="space-y-2 mb-6 flex-1">
        {p.bullets.map((b) => (
          <li key={b} className="flex gap-2 text-xs text-slate-600">
            <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
            {b}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={busy !== null || selected}
        onClick={() => onPick(id)}
        className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 ${planButtonClass(id, selected)} disabled:opacity-50`}
      >
        {planCta(id, selected, busy === id, p.monthlyPriceHtg)}
      </button>
      {p.kycRequired && (
        <p className="text-[10px] text-center text-slate-400 mt-2">KYC obligatwa</p>
      )}
    </div>
  );
}
