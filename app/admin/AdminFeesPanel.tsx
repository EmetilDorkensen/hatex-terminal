"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, Percent, RefreshCw, Search, Trash2, Save } from 'lucide-react';

type FeeSetting = {
  fee_key: string;
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

/** Admin sèlman — frè global + frè espesyal pa kont. */
export default function AdminFeesPanel() {
  const [settings, setSettings] = useState<FeeSetting[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const [ovUserId, setOvUserId] = useState('');
  const [ovFeeKey, setOvFeeKey] = useState('kyc_fee');
  const [ovValue, setOvValue] = useState('0');
  const [ovNote, setOvNote] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [userHits, setUserHits] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/fees');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Pa ka chaje frè yo.');
      setSettings(data.settings || []);
      setOverrides(data.overrides || []);
      const d: Record<string, string> = {};
      (data.settings || []).forEach((s: FeeSetting) => {
        d[s.fee_key] = String(s.value);
      });
      setDrafts(d);
      if (data.settings?.[0] && !ovFeeKey) setOvFeeKey(data.settings[0].fee_key);
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
    try {
      const res = await fetch('/api/admin/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_global', fee_key: feeKey, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Echèk.');
      await load();
      alert('Frè global mete a jou.');
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
    try {
      const res = await fetch(`/api/admin/client-dossier?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.matches)) {
        setUserHits(data.matches.slice(0, 8));
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

  const saveOverride = async () => {
    if (!ovUserId || ovUserId.length < 30) return alert('Chwazi yon kont (UUID).');
    const value = Number(ovValue);
    if (!(value >= 0)) return alert('Montan pa valab (0 = san frè pou kont sa a).');
    setBusy('override');
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
      alert('Frè espesyal pou kont lan anrejistre.');
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
            <h3 className="text-lg font-bold text-slate-900">Jesyon Frè Sistèm</h3>
            <p className="text-xs text-slate-500">Modifye frè global oswa mete frè egzak pou yon kont — admin sèlman</p>
          </div>
        </div>
        <button type="button" onClick={load} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
          <RefreshCw size={12} /> Rafrechi
        </button>
      </div>

      {msg && <p className="text-xs text-rose-600 font-bold">{msg}</p>}

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-3">
            <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Frè global (tout sistèm nan)</p>
            {settings.map((s) => (
              <div key={s.fee_key} className="flex flex-col sm:flex-row sm:items-center gap-2 border-b border-gray-50 pb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{s.label}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{s.fee_key} · {s.unit}</p>
                  {s.description && <p className="text-[10px] text-slate-500">{s.description}</p>}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={drafts[s.fee_key] ?? ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [s.fee_key]: e.target.value }))}
                  className="sm:w-32 bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold"
                />
                <button
                  type="button"
                  disabled={busy === s.fee_key}
                  onClick={() => saveGlobal(s.fee_key)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1"
                >
                  {busy === s.fee_key ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Sove
                </button>
              </div>
            ))}
          </div>

          <div className="bg-white border border-amber-100 rounded-3xl p-6 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase text-amber-700 tracking-wider">Frè espesyal pou yon kont</p>
            <p className="text-xs text-slate-500">Mete 0 pou retire frè sou kont sa a. Sa pa afekte lòt kont yo.</p>

            <div className="flex gap-2">
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Imèl oswa non pou chèche..."
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
                    onClick={() => { setOvUserId(u.id); setUserQuery(u.email || u.full_name || u.id); setUserHits([]); }}
                    className="w-full text-left text-xs bg-slate-50 hover:bg-indigo-50 border border-gray-100 rounded-lg px-3 py-2"
                  >
                    <span className="font-bold">{u.full_name}</span> · {u.email}
                    <span className="block font-mono text-[10px] text-slate-400">{u.id}</span>
                  </button>
                ))}
              </div>
            )}

            <input
              value={ovUserId}
              onChange={(e) => setOvUserId(e.target.value.trim())}
              placeholder="UUID kont (oswa chwazi nan rezilta yo)"
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
                placeholder="Montan / pousantaj"
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
