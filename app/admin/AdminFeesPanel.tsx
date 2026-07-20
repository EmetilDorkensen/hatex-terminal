"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, Percent, RefreshCw, Search, Trash2, Save, Info } from 'lucide-react';

type FeeSetting = {
  fee_key: string;
  label: string;
  value: number;
  unit: string;
  description?: string | null;
};

type LimitSetting = {
  limit_key: string;
  label: string;
  value: number;
  unit: string;
  description?: string | null;
};

type OverrideRow = {
  id: string;
  user_id: string;
  fee_key: string;
  value: number;
  note?: string | null;
  profiles?: { full_name?: string; email?: string } | null;
};

const FEE_ORDER = [
  'deposit_fee_percent',
  'withdraw_fee_percent',
  'agent_withdraw_fee_per_1000',
  'transfer_fee_percent',
  'agent_fee_per_1000',
  'kyc_fee',
  'enterprise_application_fee',
  'api_fee_per_1000',
  'card_activation_fee',
];

const FEE_EXAMPLES: Record<string, (v: number) => string> = {
  deposit_fee_percent: (v) =>
    `Depo 10 000 HTG → kliyan peye ${(10000 + 10000 * (v / 100)).toLocaleString()} (frè ${(10000 * (v / 100)).toLocaleString()} HTG)`,
  withdraw_fee_percent: (v) =>
    `Retrè MonCash 10 000 → resevwa ${(10000 - 10000 * (v / 100)).toLocaleString()} HTG (frè ${(10000 * (v / 100)).toLocaleString()})`,
  agent_withdraw_fee_per_1000: (v) =>
    `Retrè ajan 10 000 kach → frè ${((10000 / 1000) * v).toLocaleString()} HTG (20% ajan / 80% Hatex)`,
  transfer_fee_percent: (v) =>
    `Echèl P2P: ${v}/5 × tablo MonCash. Egz. 1 000 HTG → baz 25 × ${(v / 5).toFixed(2)} = ${(25 * (v / 5)).toLocaleString()} HTG. 0 = gratis.`,
  agent_fee_per_1000: (v) =>
    `PRO 55 000 → frè ${Math.floor((55000 / 1000) * v).toLocaleString()} HTG · PREMIUM 110 000 → frè ${Math.floor((110000 / 1000) * v).toLocaleString()} HTG`,
  kyc_fee: (v) => `Premye pati: ${v.toLocaleString()} HTG pou soumèt dokiman KYC (pwofi biznis)`,
  enterprise_application_fee: (v) => `Pasaj antrepriz: ${v.toLocaleString()} HTG (ranbouse si rejte)`,
  api_fee_per_1000: (v) =>
    `API resevwa 10 000 → frè ${((10000 / 1000) * v).toLocaleString()} HTG, machann net ${(10000 - (10000 / 1000) * v).toLocaleString()}`,
  card_activation_fee: (v) =>
    `Dezyèm pati: ${v.toLocaleString()} HTG pou debloke kat, terminal ak fakti apre KYC apwouve`,
};

const UNIT_HINT: Record<string, string> = {
  percent: '%',
  per_1000: 'HTG / 1 000',
  flat: 'HTG (montan fiks)',
};

/** Admin sèlman — frè global + frè espesyal pa kont (konekte ak baz). */
export default function AdminFeesPanel() {
  const [settings, setSettings] = useState<FeeSetting[]>([]);
  const [limits, setLimits] = useState<LimitSetting[]>([]);
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [agentTiers, setAgentTiers] = useState<{ tier: string; capacity_htg: number; label: string }[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const [ovUserId, setOvUserId] = useState('');
  const [ovFeeKey, setOvFeeKey] = useState('deposit_fee_percent');
  const [ovValue, setOvValue] = useState('0');
  const [ovNote, setOvNote] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [userHits, setUserHits] = useState<any[]>([]);
  const [previewUser, setPreviewUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [previewFees, setPreviewFees] = useState<Record<string, number> | null>(null);

  const load = async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/fees');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Pa ka chaje frè yo. Verifye migrasyon 20260750/52.');
      const list = (data.settings || []) as FeeSetting[];
      list.sort((a, b) => FEE_ORDER.indexOf(a.fee_key) - FEE_ORDER.indexOf(b.fee_key));
      setSettings(list);
      setOverrides(data.overrides || []);
      setLimits(data.limits || []);
      setAgentTiers(data.agent_tiers || []);
      const d: Record<string, string> = {};
      list.forEach((s) => {
        d[s.fee_key] = String(s.value);
      });
      setDrafts(d);
      const ld: Record<string, string> = {};
      (data.limits || []).forEach((l: LimitSetting) => {
        ld[l.limit_key] = String(l.value);
      });
      setLimitDrafts(ld);
      if (list[0] && !list.find((s) => s.fee_key === ovFeeKey)) {
        setOvFeeKey(list[0].fee_key);
      }
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveGlobal = async (feeKey: string) => {
    const value = Number(drafts[feeKey]);
    if (!(value >= 0) || !Number.isFinite(value)) return alert('Montan pa valab.');
    setBusy(feeKey);
    setOkMsg('');
    try {
      const res = await fetch('/api/admin/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_global', fee_key: feeKey, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Echèk sove nan baz done.');
      await load();
      setOkMsg(`Frè « ${feeKey} » sove nan baz: ${value}. Nouvo tranzaksyon ap itilize l.`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  const saveLimit = async (limitKey: string) => {
    const value = Number(limitDrafts[limitKey]);
    if (!(value >= 0) || !Number.isFinite(value)) return alert('Montan pa valab.');
    setBusy(`lim-${limitKey}`);
    setOkMsg('');
    try {
      const res = await fetch('/api/admin/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_limit', limit_key: limitKey, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Echèk sove limit.');
      await load();
      setOkMsg(`Limit « ${limitKey} » sove: ${value}.`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  const saveTier = async (tier: string, capacity: number) => {
    setBusy(`tier-${tier}`);
    try {
      const res = await fetch('/api/admin/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_agent_tier', tier, capacity_htg: capacity }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Echèk.');
      await load();
      setOkMsg(`Kapasite ajan ${tier.toUpperCase()} → ${capacity.toLocaleString()} HTG`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  const searchUsers = async () => {
    const q = userQuery.trim();
    if (q.length < 2) return;
    setBusy('search');
    setMsg('');
    try {
      const res = await fetch(`/api/admin/client-dossier?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.matches)) {
        setUserHits(data.matches.slice(0, 8));
        if (data.matches.length === 0) setMsg('Pa jwenn kont.');
      } else {
        setUserHits([]);
        setMsg(data.error || 'Pa jwenn kont.');
      }
    } catch {
      setUserHits([]);
    } finally {
      setBusy(null);
    }
  };

  const pickUser = async (u: any) => {
    setOvUserId(u.id);
    setUserQuery(u.email || u.full_name || u.id);
    setUserHits([]);
    setPreviewUser({ id: u.id, name: u.full_name || 'Kliyan', email: u.email || '' });
    try {
      const res = await fetch(`/api/admin/fees?user_id=${encodeURIComponent(u.id)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const map: Record<string, number> = {};
        (data.settings || []).forEach((s: FeeSetting) => {
          map[s.fee_key] = Number(s.value);
        });
        (data.overrides || []).forEach((o: OverrideRow) => {
          map[o.fee_key] = Number(o.value);
        });
        setPreviewFees(map);
      }
    } catch {
      setPreviewFees(null);
    }
  };

  const saveOverride = async () => {
    if (!ovUserId || ovUserId.length < 30) return alert('Chwazi yon kont (UUID).');
    const value = Number(ovValue);
    if (!(value >= 0) || !Number.isFinite(value)) return alert('Montan pa valab (0 = san frè pou kont sa a).');
    setBusy('override');
    setOkMsg('');
    try {
      const res = await fetch('/api/admin/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_override',
          user_id: ovUserId,
          fee_key: ovFeeKey,
          value,
          note: ovNote,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Echèk.');
      setOvNote('');
      await load();
      if (previewUser?.id === ovUserId) await pickUser({ id: ovUserId, full_name: previewUser.name, email: previewUser.email });
      setOkMsg(`Override sove pou kont lan: ${ovFeeKey} = ${value}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  const clearOverride = async (userId: string, feeKey: string) => {
    if (!confirm('Retire frè espesyal sa a? Kont lan ap itilize frè global ankò.')) return;
    setBusy(`del-${userId}-${feeKey}`);
    try {
      const res = await fetch('/api/admin/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_override', user_id: userId, fee_key: feeKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Echèk.');
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-700 rounded-xl"><Percent size={22} /></div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Frè Sistèm (menm jan sou app la)</h3>
            <p className="text-xs text-slate-500">
              Chak chanjman sove dirèk nan baz done. Nouvo depo / retrè / P2P / ajan / API ap li yo.
            </p>
          </div>
        </div>
        <button type="button" onClick={load} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
          <RefreshCw size={12} /> Rafrechi
        </button>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-3 text-xs text-indigo-900">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-bold mb-1">Kijan li mache</p>
          <p>1) Modifye frè global → Sove. 2) Oswa chwazi yon kont epi mete frè espesyal (0 = gratis pou kont sa a). 3) Kouri SQL <code className="bg-white px-1 rounded">20260752</code> si chanjman yo pa aplike nan tranzaksyon.</p>
        </div>
      </div>

      {msg && <p className="text-xs text-rose-600 font-bold">{msg}</p>}
      {okMsg && <p className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{okMsg}</p>}

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Frè global — jan yo ye sou sistèm nan</p>
            {settings.length === 0 ? (
              <p className="text-sm text-rose-600 font-bold">
                Tablo frè vid. Kouri migrasyon 20260750 oswa 20260752 nan Supabase SQL Editor.
              </p>
            ) : (
              settings.map((s) => {
                const draftVal = Number(drafts[s.fee_key] ?? s.value);
                const proCap = Number(agentTiers.find((t) => t.tier === 'pro')?.capacity_htg || 55000);
                const premCap = Number(agentTiers.find((t) => t.tier === 'premium')?.capacity_htg || 110000);
                const example =
                  s.fee_key === 'agent_fee_per_1000'
                    ? `PRO ${proCap.toLocaleString()} → frè ${Math.floor((proCap / 1000) * draftVal).toLocaleString()} HTG · PREMIUM ${premCap.toLocaleString()} → frè ${Math.floor((premCap / 1000) * draftVal).toLocaleString()} HTG`
                    : FEE_EXAMPLES[s.fee_key]?.(Number.isFinite(draftVal) ? draftVal : Number(s.value));
                return (
                  <div key={s.fee_key} className="border border-slate-100 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900">{s.label}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {s.fee_key} · {UNIT_HINT[s.unit] || s.unit}
                        </p>
                        {example && (
                          <p className="text-xs text-slate-600 mt-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                            {example}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={drafts[s.fee_key] ?? ''}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [s.fee_key]: e.target.value }))}
                          className="w-28 bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                        />
                        <button
                          type="button"
                          disabled={busy === s.fee_key}
                          onClick={() => saveGlobal(s.fee_key)}
                          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1 min-w-[88px]"
                        >
                          {busy === s.fee_key ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                          Sove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="bg-white border border-emerald-100 rounded-3xl p-6 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase text-emerald-700 tracking-wider">Limit sistèm (baz done)</p>
            {limits.length === 0 ? (
              <p className="text-sm text-rose-600 font-bold">Kouri migrasyon 20260759 pou tablo platform_limit_settings.</p>
            ) : (
              limits.map((l) => (
                <div key={l.limit_key} className="flex flex-col sm:flex-row sm:items-center gap-3 border border-slate-100 rounded-2xl p-4">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">{l.label}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{l.limit_key}</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={limitDrafts[l.limit_key] ?? ''}
                    onChange={(e) => setLimitDrafts((prev) => ({ ...prev, [l.limit_key]: e.target.value }))}
                    className="w-32 bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                  />
                  <button
                    type="button"
                    disabled={busy === `lim-${l.limit_key}`}
                    onClick={() => saveLimit(l.limit_key)}
                    className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase"
                  >
                    {busy === `lim-${l.limit_key}` ? '...' : 'Sove'}
                  </button>
                </div>
              ))
            )}
            {agentTiers.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Kapasite ajan (agent_tiers)</p>
                {agentTiers.map((t) => (
                  <div key={t.tier} className="flex items-center gap-3">
                    <span className="text-sm font-bold w-24">{t.label || t.tier}</span>
                    <input
                      type="number"
                      defaultValue={t.capacity_htg}
                      id={`tier-cap-${t.tier}`}
                      className="w-32 bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold"
                    />
                    <button
                      type="button"
                      disabled={busy === `tier-${t.tier}`}
                      onClick={() => {
                        const el = document.getElementById(`tier-cap-${t.tier}`) as HTMLInputElement | null;
                        saveTier(t.tier, Number(el?.value || t.capacity_htg));
                      }}
                      className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold"
                    >
                      Sove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-amber-100 rounded-3xl p-6 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase text-amber-700 tracking-wider">Frè espesyal pou yon kont</p>
            <p className="text-xs text-slate-500">
              Chwazi kont → chwazi kalite frè → mete valè (0 = san frè pou kont sa a sèlman).
            </p>

            <div className="flex gap-2">
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Chèche imèl oswa non..."
                className="flex-1 bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
              <button type="button" onClick={searchUsers} className="bg-slate-900 text-white px-4 rounded-xl text-xs font-bold uppercase flex items-center gap-1">
                <Search size={12} /> Chèche
              </button>
            </div>
            {userHits.length > 0 && (
              <div className="space-y-1">
                {userHits.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => pickUser(u)}
                    className="w-full text-left text-xs bg-slate-50 hover:bg-indigo-50 border border-gray-100 rounded-lg px-3 py-2"
                  >
                    <span className="font-bold">{u.full_name}</span> · {u.email}
                    <span className="block font-mono text-[10px] text-slate-400">{u.id}</span>
                  </button>
                ))}
              </div>
            )}

            {previewUser && (
              <div className="bg-amber-50/80 border border-amber-100 rounded-2xl p-3 text-xs">
                <p className="font-bold text-amber-900">{previewUser.name} · {previewUser.email}</p>
                {previewFees && (
                  <p className="text-amber-800/80 mt-1">
                    Frè aktif pou kont sa a: depo {previewFees.deposit_fee_percent ?? '—'}% ·
                    retrè {previewFees.withdraw_fee_percent ?? '—'}% ·
                    ajan {previewFees.agent_withdraw_fee_per_1000 ?? '—'}/1000 ·
                    KYC {previewFees.kyc_fee ?? '—'} + debloke {previewFees.card_activation_fee ?? '—'} HTG
                  </p>
                )}
              </div>
            )}

            <input
              value={ovUserId}
              onChange={(e) => setOvUserId(e.target.value.trim())}
              placeholder="UUID kont"
              className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono"
            />
            <div className="grid sm:grid-cols-3 gap-2">
              <select
                value={ovFeeKey}
                onChange={(e) => setOvFeeKey(e.target.value)}
                className="bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
              >
                {settings.map((s) => (
                  <option key={s.fee_key} value={s.fee_key}>{s.label}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={ovValue}
                onChange={(e) => setOvValue(e.target.value)}
                placeholder="Montan"
                className="bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold"
              />
              <button
                type="button"
                disabled={busy === 'override'}
                onClick={saveOverride}
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold uppercase"
              >
                {busy === 'override' ? '...' : 'Aplike sou kont'}
              </button>
            </div>
            <input
              value={ovNote}
              onChange={(e) => setOvNote(e.target.value)}
              placeholder="Nòt (opsyonèl)"
              className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />

            <div className="pt-2 space-y-2">
              <p className="text-[10px] font-bold uppercase text-slate-400">Override aktif</p>
              {overrides.length === 0 ? (
                <p className="text-sm text-slate-400">Pa gen frè espesyal pou kounye a.</p>
              ) : (
                overrides.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 text-xs bg-slate-50 rounded-xl px-3 py-2 border border-gray-100">
                    <div>
                      <p className="font-bold text-slate-800">{o.profiles?.full_name || o.user_id.slice(0, 8)}</p>
                      <p className="text-slate-500">{o.profiles?.email} · {o.fee_key} = <strong>{o.value}</strong></p>
                    </div>
                    <button
                      type="button"
                      onClick={() => clearOverride(o.user_id, o.fee_key)}
                      className="text-rose-600 p-2 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
