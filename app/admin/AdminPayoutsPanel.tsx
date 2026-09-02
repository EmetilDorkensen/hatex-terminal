"use client";

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Landmark,
  Loader2,
  RefreshCw,
  Send,
  Smartphone,
  XCircle,
  Zap,
} from 'lucide-react';

type BankRow = {
  id: string;
  kind: string;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  routing_number: string | null;
  swift_code: string | null;
  stripe_connect_account_id: string | null;
  stripe_external_account_id: string | null;
};

type ProfileRow = { email: string | null; full_name: string | null };

type PayoutRow = {
  id: string;
  payment_id: string;
  merchant_id: string;
  mode: string;
  receiver_provider: string;
  receiver_phone: string;
  amount: number;
  currency: string;
  amount_usd: number | null;
  rate_used: number | null;
  bank_account_id: string | null;
  status: string;
  attempt_count: number;
  next_retry_at: string | null;
  last_error: string | null;
  moncash_transaction_id: string | null;
  provider_transaction_id: string | null;
  reference: string;
  created_at: string;
  paid_at: string | null;
  confirmed_at: string | null;
  manual_note: string | null;
  wallet_full: boolean;
  profiles: ProfileRow | null;
  hatex_bank_accounts: BankRow | null;
};

type Stats = { pending: number; processing: number; paid: number; failed: number; skipped: number };

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  skipped: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'An atant',
  processing: 'Ap trete',
  paid: 'Pe',
  failed: 'Echwe',
  skipped: 'Sote',
};

function providerLabel(kind: string): string {
  if (kind === 'moncash') return 'MonCash';
  if (kind === 'natcash') return 'Natcash';
  if (kind === 'bank_us') return 'Bank USA';
  return 'Bank Ayiti';
}

function fmtAmount(p: PayoutRow): string {
  if (p.currency === 'USD') {
    return `$${Number(p.amount_usd || 0).toFixed(2)} USD`;
  }
  return `${Number(p.amount).toLocaleString('fr-FR')} HTG`;
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function receiverText(p: PayoutRow): string {
  if (p.receiver_provider === 'moncash' || p.receiver_provider === 'natcash') {
    const ph = p.receiver_phone;
    return ph ? `+${ph.replace(/^509/, '')}` : '—';
  }
  const acc = p.hatex_bank_accounts?.account_number || p.receiver_phone;
  if (acc && acc.length > 4) return `•••• ${acc.slice(-4)}`;
  return acc || '—';
}

/** Admin — lapo payout: retry MonCash + konfimasyon bank / Stripe Connect tès. */
export default function AdminPayoutsPanel() {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, processing: 0, paid: 0, failed: 0, skipped: 0 });
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | string>('all');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const load = async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/payouts');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Pa ka chaje payout yo.');
      setPayouts(data.payouts || []);
      setStats(data.stats || { pending: 0, processing: 0, paid: 0, failed: 0, skipped: 0 });
      setStripeConfigured(!!data.stripe?.configured);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erè.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const run = async (payoutId: string, action: string) => {
    setBusyId(`${action}:${payoutId}`);
    setOkMsg('');
    setMsg('');
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payoutId, note: notes[payoutId] || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Aksyon echwe.');
      setOkMsg(data.message || `Aksyon "${action}" fini.`);
      setNotes((prev) => ({ ...prev, [payoutId]: '' }));
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erè.');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = payouts.filter((p) => filter === 'all' || p.status === filter);

  const statCards = [
    { key: 'pending', label: 'An atant', value: stats.pending, color: 'bg-amber-100 text-amber-700' },
    { key: 'processing', label: 'Ap trete', value: stats.processing, color: 'bg-blue-100 text-blue-700' },
    { key: 'paid', label: 'Pe', value: stats.paid, color: 'bg-emerald-100 text-emerald-700' },
    { key: 'failed', label: 'Echwe', value: stats.failed, color: 'bg-rose-100 text-rose-700' },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Payout</h2>
          <p className="text-sm text-slate-500">
            Retry MonCash, konfimasyon bank / Stripe Connect (tès) — tout aksyon anrejistre.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Rafrechi
        </button>
      </div>

      {msg && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{msg}</span>
        </div>
      )}
      {okMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{okMsg}</span>
        </div>
      )}

      {!stripeConfigured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            STRIPE_SECRET_KEY pa konfigire — payout bank yo disponib pou MonCash sèlman. Wè{' '}
            <code className="rounded bg-amber-100 px-1">docs/stripe-bank-payouts.md</code>.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.key} className={`rounded-xl px-4 py-3 ${s.color}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'processing', 'paid', 'failed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              filter === f
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'Tout' : STATUS_LABEL[f] || f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">Pa gen payout pou filtè sa a.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const isPending = p.status === 'pending';
            const isProcessing = p.status === 'processing';
            const isFailed = p.status === 'failed';
            const canAct = isPending || isProcessing;
            const isMoncash = p.receiver_provider === 'moncash';
            const bank = p.hatex_bank_accounts;
            const canStripe = bank?.kind === 'bank_us' && (isPending || isFailed);
            const canRefresh = !!p.provider_transaction_id && p.status !== 'paid';
            return (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_STYLE[p.status] || 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                      {p.receiver_provider === 'moncash' || p.receiver_provider === 'natcash' ? (
                        <Smartphone className="h-3 w-3" />
                      ) : (
                        <Landmark className="h-3 w-3" />
                      )}
                      {providerLabel(p.receiver_provider)}
                    </span>
                    {p.mode === 'live' && (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-600 border border-rose-200">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-slate-800">{fmtAmount(p)}</div>
                </div>


                <div className="mt-3 grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Mèchan:</span>
                    <span className="truncate font-medium text-slate-700">
                      {p.profiles?.email || p.profiles?.full_name || p.merchant_id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Resevwa:</span>
                    <span className="font-medium text-slate-700">{receiverText(p)}</span>
                    {bank?.bank_name && (
                      <span className="truncate text-xs text-slate-400">{bank.bank_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Dat:</span>
                    <span className="font-medium text-slate-700">{fmtDate(p.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Ref:</span>
                    <span className="truncate font-mono text-xs text-slate-700">
                      {p.reference || p.id.slice(0, 12)}
                    </span>
                  </div>
                  {p.currency === 'USD' && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">To:</span>
                      <span className="font-medium text-slate-700">
                        {Number(p.amount).toLocaleString('fr-FR')} HTG @{' '}
                        {Number(p.rate_used).toFixed(2)} HTG/USD
                      </span>
                    </div>
                  )}
                  {p.provider_transaction_id && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Stripe ID:</span>
                      <span className="truncate font-mono text-xs text-slate-700">
                        {p.provider_transaction_id}
                      </span>
                    </div>
                  )}
                  {p.attempt_count > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Esè:</span>
                      <span className="font-medium text-slate-700">{p.attempt_count}</span>
                    </div>
                  )}
                </div>

                {p.last_error && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2 text-xs text-rose-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="break-words">{p.last_error}</span>
                  </div>
                )}
                {p.manual_note && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Nòt: {p.manual_note}
                  </div>
                )}


                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    value={notes[p.id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="Nòt (si ou vle)..."
                    className="w-full max-w-[220px] rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                  />
                  <div className="ml-auto flex flex-wrap gap-2">
                    {canAct && (
                      <button
                        onClick={() => run(p.id, 'confirm')}
                        disabled={busyId !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Konfime peye
                      </button>
                    )}
                    {canStripe && (
                      <button
                        onClick={() => run(p.id, 'stripe_pay')}
                        disabled={busyId !== null}
                        title={stripeConfigured ? undefined : 'Konfigire STRIPE_SECRET_KEY an premye'}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                        Voye via Stripe
                      </button>
                    )}
                    {canRefresh && (
                      <button
                        onClick={() => run(p.id, 'stripe_refresh')}
                        disabled={busyId !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Rafrechi Stripe
                      </button>
                    )}
                    {(isPending || isFailed) && isMoncash && (
                      <button
                        onClick={() => run(p.id, 'retry')}
                        disabled={busyId !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                      >
                        <Zap className="h-4 w-4" />
                        Retry
                      </button>
                    )}
                    {canAct && (
                      <button
                        onClick={() => run(p.id, 'fail')}
                        disabled={busyId !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Refize
                      </button>
                    )}
                    {busyId?.endsWith(`:${p.id}`) && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Ap trete...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

