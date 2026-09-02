"use client";

import React, { useEffect, useState } from 'react';
import { Info, Loader2, Percent, RefreshCw, Save } from 'lucide-react';

type GatewayRow = {
  key: string;
  label: string;
  value: number;
  unit: string;
  description?: string | null;
};

type RevenueRow = {
  id: string;
  purpose: string;
  amount: number;
  description: string | null;
  created_at: string;
  merchant_id: string;
};

const GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'Frè pasrèl (kliyan peye anplis)',
    keys: [
      'platform_fee_percent',
      'platform_fee_min_htg',
      'payout_fee_percent',
      'payout_fee_min_htg',
    ],
  },
  {
    title: 'Limit tranzaksyon',
    keys: [
      'min_amount_per_tx_htg',
      'max_amount_per_tx_htg',
      'limit_individual_month_htg',
      'limit_business_month_htg',
      'payment_link_ttl_minutes',
    ],
  },
  {
    title: 'Plan abonnman ak kota jou',
    keys: [
      'plan_capacity_price_htg',
      'plan_premium_price_htg',
      'daily_limit_free_htg',
      'daily_limit_capacity_htg',
    ],
  },
  {
    title: 'Konvèsyon',
    keys: ['payout_usd_htg_rate'],
  },
];

const UNIT_HINT: Record<string, string> = {
  percent: '%',
  htg: 'HTG',
  count: 'minit / konte',
};

function groupFor(key: string): string {
  for (const g of GROUPS) {
    if (g.keys.includes(key)) return g.title;
  }
  return 'Lòt';
}

/** Admin — frè ak kota nouvo pasrèl la (hatex_gateway_settings). */
export default function AdminFeesPanel() {
  const [settings, setSettings] = useState<GatewayRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [callbacks, setCallbacks] = useState<{ alert: string; return: string } | null>(null);
  const [revenue, setRevenue] = useState<{
    platform_fees: number;
    plan_fees: number;
    recent: RevenueRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const load = async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/fees');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Pa ka chaje frè pasrèl yo.');
      const list = (data.settings || []) as GatewayRow[];
      setSettings(list);
      const d: Record<string, string> = {};
      list.forEach((s) => {
        d[s.key] = String(s.value);
      });
      setDrafts(d);
      setCallbacks(data.callbacks || null);
      setRevenue(data.revenue || null);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erè.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (key: string) => {
    const value = Number(drafts[key]);
    if (value < 0 || !Number.isFinite(value)) {
      alert('Montan pa valab.');
      return;
    }
    setBusy(key);
    setOkMsg('');
    try {
      const res = await fetch('/api/admin/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', key, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Echèk sove.');
      await load();
      setOkMsg(`${key} sove: ${value}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Echèk.');
    } finally {
      setBusy(null);
    }
  };

  const settlePending = async () => {
    setBusy('settle');
    setOkMsg('');
    try {
      const res = await fetch('/api/admin/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settle_pending' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Echèk.');
      setOkMsg(`Peman pending verifye: ${data.paid || 0} peye sou ${data.checked || 0}.`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Echèk.');
    } finally {
      setBusy(null);
    }
  };

  const grouped = GROUPS.map((g) => ({
    ...g,
    rows: g.keys
      .map((k) => settings.find((s) => s.key === k))
      .filter((s): s is GatewayRow => Boolean(s)),
  })).filter((g) => g.rows.length > 0);

  const extra = settings.filter((s) => groupFor(s.key) === 'Lòt');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
            <Percent size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Frè ak kota pasrèl</h3>
            <p className="text-xs text-slate-500">
              Frè sou chak peman MonCash, pri abonnman, ak limit jou. Chanjman yo antre nan baz
              done a touswit.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => void load()} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
          <RefreshCw size={12} /> Rafrechi
        </button>
      </div>

      {callbacks && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-3 text-xs text-indigo-900">
          <Info size={16} className="shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="font-bold">URL pou mete nan pòtay Digicel Business (sandbox + live)</p>
            <p className="font-mono break-all">Alert: {callbacks.alert}</p>
            <p className="font-mono break-all">Return: {callbacks.return}</p>
            <p className="text-indigo-800/80">
              Pa janm mete yon lyen vercel.app oswa localhost. Si yo mal, kliyan wè 404 apre peman
              e plan an pa aktive.
            </p>
          </div>
        </div>
      )}

      {revenue && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              Frè pasrèl kolekte
            </p>
            <p className="text-2xl font-black text-slate-900">
              {Number(revenue.platform_fees).toLocaleString('fr-FR')}{' '}
              <span className="text-sm font-semibold text-slate-500">HTG</span>
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              Kob abonnman kolekte
            </p>
            <p className="text-2xl font-black text-indigo-700">
              {Number(revenue.plan_fees).toLocaleString('fr-FR')}{' '}
              <span className="text-sm font-semibold text-slate-500">HTG</span>
            </p>
          </div>
        </div>
      )}

      {revenue && revenue.recent.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm overflow-x-auto">
          <p className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-4">
            Dènye frè ak abonnman
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-gray-100">
                <th className="pb-2 pr-3 font-bold">Dat</th>
                <th className="pb-2 pr-3 font-bold">Kalite</th>
                <th className="pb-2 pr-3 font-bold">Deskripsyon</th>
                <th className="pb-2 font-bold text-right">Montan</th>
              </tr>
            </thead>
            <tbody>
              {revenue.recent.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2 pr-3 font-semibold text-slate-800">
                    {r.purpose === 'plan_fee'
                      ? 'Abonnman'
                      : r.purpose === 'kyc_fee'
                        ? 'KYC'
                        : 'Frè pasrèl'}
                  </td>
                  <td className="py-2 pr-3 text-slate-600 max-w-[200px] truncate">
                    {r.description || '—'}
                  </td>
                  <td className="py-2 font-bold text-slate-900 text-right whitespace-nowrap">
                    {Number(r.amount).toLocaleString('fr-FR')} HTG
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-slate-600">
          Si yon kliyan peye MonCash men kapasite a rete 25 000 HTG, verifye peman pending yo isit
          la.
        </p>
        <button
          type="button"
          disabled={busy === 'settle'}
          onClick={() => void settlePending()}
          className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 shrink-0"
        >
          {busy === 'settle' ? 'Ap verifye...' : 'Règle peman pending'}
        </button>
      </div>

      {msg && <p className="text-xs text-rose-600 font-bold">{msg}</p>}
      {okMsg && (
        <p className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          {okMsg}
        </p>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          {grouped.map((g) => (
            <div key={g.title} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
              <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">{g.title}</p>
              {g.rows.map((s) => (
                <div key={s.key} className="flex flex-col sm:flex-row sm:items-start gap-3 border border-slate-100 rounded-2xl p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{s.label}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {s.key} · {UNIT_HINT[s.unit] || s.unit}
                    </p>
                    {s.description && <p className="text-xs text-slate-600 mt-2">{s.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={drafts[s.key] ?? ''}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                      className="w-28 bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                    />
                    <button
                      type="button"
                      disabled={busy === s.key}
                      onClick={() => void save(s.key)}
                      className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1 min-w-[88px]"
                    >
                      {busy === s.key ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Sove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {extra.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
              <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Lòt</p>
              {extra.map((s) => (
                <div key={s.key} className="flex flex-col sm:flex-row sm:items-center gap-3 border border-slate-100 rounded-2xl p-4">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">{s.label}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{s.key}</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={drafts[s.key] ?? ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                    className="w-28 bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                  />
                  <button
                    type="button"
                    disabled={busy === s.key}
                    onClick={() => void save(s.key)}
                    className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase"
                  >
                    Sove
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
