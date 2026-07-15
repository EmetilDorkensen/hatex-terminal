"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Copy, CheckCircle2, XCircle, Store } from 'lucide-react';

type PendingReq = {
  id: string;
  agent_code: string;
  amount: number;
  payment_account: string | null;
  proof_path: string | null;
  created_at: string;
  profiles?: { full_name?: string; email?: string; agent_balance?: number; agent_capacity?: number } | null;
};

/**
 * Rechaj ajan san frè — admin / kesye:
 * 1) Trete demann ak prèv
 * 2) Oswa kopye kòd ajan + montan pou kredite dirèkteman
 * Tout balans pase RPC sèvè (pa navigatè).
 */
export default function AdminAgentRechargePanel() {
  const [pending, setPending] = useState<PendingReq[]>([]);
  const [kesBalance, setKesBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [agentCode, setAgentCode] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/agent-recharge');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Pa ka chaje demann yo.');
      setPending(data.pending || []);
      setKesBalance(Number(data.kes_global_balance || 0));
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const creditByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = agentCode.replace(/\D/g, '').slice(0, 8);
    const amount = Number(creditAmount);
    if (code.length !== 8 || !(amount > 0)) {
      return alert('Kòd 8 chif + montan obligatwa.');
    }
    setBusyId('credit');
    setMsg('');
    try {
      const res = await fetch('/api/admin/agent-recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'credit_by_code', agent_code: code, amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Echèk kredite.');
      alert(`Siksè! ${data.agent_name || 'Ajan'} resevwa ${amount.toLocaleString()} HTG (0 frè).\nNouvo balans: ${Number(data.agent_balance || 0).toLocaleString()} HTG`);
      setAgentCode('');
      setCreditAmount('');
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const review = async (requestId: string, review_action: 'approved' | 'rejected') => {
    const reason = rejectReasons[requestId] || '';
    if (review_action === 'rejected' && !reason.trim()) {
      return alert('Ekri yon rezon pou rejte dokiman/prèv la.');
    }
    setBusyId(requestId);
    try {
      const res = await fetch('/api/admin/agent-recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', request_id: requestId, review_action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Echèk.');
      alert(review_action === 'approved' ? 'Apwouve — balans ajan monte (0 frè).' : 'Demann rejte.');
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setAgentCode(code);
      alert('Kòd ajan kopye epi kole nan fòm rechaj la.');
    } catch {
      setAgentCode(code);
    }
  };

  return (
    <div className="bg-white border border-indigo-100 rounded-3xl p-6 shadow-sm space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Store size={22} /></div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Rechaj Ajan HatexCard (0 frè)</h3>
            <p className="text-xs text-slate-500">Verifye prèv · apwouve/rejte · oswa kredite pa kòd ajan</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-slate-400">Kès Global (treasury)</p>
          <p className="text-lg font-bold text-emerald-700">{kesBalance.toLocaleString()} HTG</p>
        </div>
      </div>

      <form onSubmit={creditByCode} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Kredite dirèkteman (kole kòd ajan)</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            maxLength={8}
            value={agentCode}
            onChange={(e) => setAgentCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="Kòd ajan 8 chif"
            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono tracking-widest outline-none focus:border-indigo-500"
          />
          <input
            type="number"
            min="1"
            value={creditAmount}
            onChange={(e) => setCreditAmount(e.target.value)}
            placeholder="Montan HTG"
            className="sm:w-40 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={busyId === 'credit'}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2"
          >
            {busyId === 'credit' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Kredite 0 frè
          </button>
        </div>
      </form>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Demann k ap tann ({pending.length})</p>
          <button type="button" onClick={load} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
            <RefreshCw size={12} /> Rafrechi
          </button>
        </div>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
        ) : pending.length === 0 ? (
          <p className="text-sm text-slate-400 font-medium text-center py-6">Pa gen demann rechaj k ap tann.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{r.profiles?.full_name || 'Ajan'}</p>
                    <p className="text-xs text-slate-500">{r.profiles?.email}</p>
                    <p className="text-xs font-mono text-indigo-700 mt-1">
                      Kòd: {r.agent_code}{' '}
                      <button type="button" onClick={() => copyCode(r.agent_code)} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500 hover:text-indigo-600">
                        <Copy size={12} /> Kopye
                      </button>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-slate-900">{Number(r.amount).toLocaleString()} HTG</p>
                    <p className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleString()}</p>
                    <p className="text-xs text-slate-600 mt-1">Kont: {r.payment_account || '—'}</p>
                  </div>
                </div>
                {r.proof_path && (
                  <a
                    href={`/api/admin/agent-recharge/proof?id=${encodeURIComponent(r.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-indigo-600 underline"
                  >
                    Wè prèv peman
                  </a>
                )}
                <textarea
                  value={rejectReasons[r.id] || ''}
                  onChange={(e) => setRejectReasons((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Rezon si w ap rejte (prèv fo, montan pa matche…)"
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl p-3 text-xs outline-none"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => review(r.id, 'rejected')}
                    className="flex-1 border border-rose-200 text-rose-600 py-2.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1"
                  >
                    <XCircle size={14} /> Rejte
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => review(r.id, 'approved')}
                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1"
                  >
                    {busyId === r.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Apwouve 0 frè
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {msg && <p className="text-xs text-rose-600 font-bold mt-2">{msg}</p>}
      </div>
    </div>
  );
}
