"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, MessageCircle, RefreshCcw, Search, Send, Users } from 'lucide-react';
import { KYC_SURVEY_WHATSAPP_URL } from '@/lib/kyc/survey';

type ResponseRow = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  kyc_status_label?: string;
  free_text?: string | null;
  created_at: string;
  staff_replied_at?: string | null;
  staff_reply_preview?: string | null;
  labeled_answers?: { question: string; answer: string }[];
};

type PendingRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  kyc_status?: string | null;
  kyc_status_label?: string;
  created_at?: string;
  last_survey_sent_at?: string | null;
  survey_sent_recently?: boolean;
  account_status?: string | null;
};

type Props = {
  mode: 'admin' | 'workspace';
};

export default function KycSurveyPanel({ mode }: Props) {
  const listUrl = mode === 'admin' ? '/api/admin/kyc-survey' : '/api/workspace/kyc-survey';
  const replyUrl = mode === 'admin' ? '/api/admin/kyc-survey/reply' : '/api/workspace/kyc-survey';
  const sendUrl = mode === 'admin' ? '/api/admin/kyc-survey/send' : '/api/workspace/kyc-survey/send';

  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [totalSends, setTotalSends] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ResponseRow | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(listUrl);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Pa ka chaje.');
      setResponses(data.responses || []);
      setPending(data.pending_kyc || []);
      setTotalSends(typeof data.total_sends === 'number' ? data.total_sends : null);
    } catch (e: any) {
      setError(e.message || 'Erè.');
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredPending = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter(
      (p) =>
        String(p.full_name || '')
          .toLowerCase()
          .includes(q) ||
        String(p.email || '')
          .toLowerCase()
          .includes(q)
    );
  }, [pending, search]);

  const sendSurvey = async (userId: string, force = false) => {
    setSendingId(userId);
    setOkMsg('');
    setError('');
    try {
      let res = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, force }),
      });
      let data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Voye echwe.');

      if (data.already_recent && !force) {
        const ok = window.confirm(
          'Email deja voye nan dènye 24 èdtan. Ou vle renvoy kesyonman an ankò?'
        );
        if (!ok) {
          setOkMsg(data.message || 'Deja voye nan 24h.');
          return;
        }
        res = await fetch(sendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, force: true }),
        });
        data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Voye echwe.');
      }

      setOkMsg(data.message || 'Kesyonman voye.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Erè.');
    } finally {
      setSendingId(null);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    setOkMsg('');
    setError('');
    try {
      const res = await fetch(replyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_id: selected.id, message: reply.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Voye echwe.');
      setOkMsg('Repons voye pa email.');
      setReply('');
      await load();
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              staff_replied_at: new Date().toISOString(),
              staff_reply_preview: reply.trim().slice(0, 280),
            }
          : prev
      );
    } catch (e: any) {
      setError(e.message || 'Erè.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Kesyonman KYC</h2>
          <p className="text-xs text-slate-500 mt-1">
            Voye email bay kliyan ki poko pase KYC · repons yo parèt anba
            {totalSends != null ? ` · ${totalSends} email deja voye` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={KYC_SURVEY_WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100"
          >
            <MessageCircle size={14} /> WhatsApp
          </a>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-white border border-gray-200 text-slate-600"
          >
            <RefreshCcw size={14} /> Rafrechi
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm rounded-xl p-3">{error}</div>
      )}
      {okMsg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-xl p-3">{okMsg}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">KYC pa soumèt / rejte</p>
            <p className="text-xl font-bold text-slate-900">{pending.length}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 lg:col-span-2">
          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Repons resevwa</p>
          <p className="text-xl font-bold text-slate-900">{responses.length}</p>
        </div>
      </div>

      {/* Lis kliyan san KYC + bouton voye */}
      <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Kliyan ki poko pase KYC</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Klike « Voye kesyonman » pou email la ale jwenn moun nan touswit
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Chèche non oswa imèl..."
              className="w-full bg-slate-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
          {filteredPending.length === 0 ? (
            <p className="text-center py-10 text-slate-400 text-sm font-medium">
              {search ? 'Pa gen rezilta.' : 'Tout kont pase KYC oswa nan revizyon.'}
            </p>
          ) : (
            filteredPending.map((p) => (
              <div
                key={p.id}
                className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 text-sm truncate">{p.full_name || 'San Non'}</p>
                  <p className="text-xs text-slate-500 truncate">{p.email || '—'}</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {p.kyc_status_label || 'Pa soumèt'}
                    </span>
                    {p.survey_sent_recently ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                        Voye nan 24h
                      </span>
                    ) : p.last_survey_sent_at ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">
                        Dènye: {new Date(p.last_survey_sent_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-rose-50 text-rose-600">
                        Poko janm resevwa
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={sendingId === p.id || !p.email}
                  onClick={() => sendSurvey(p.id, false)}
                  className="shrink-0 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 shadow-sm"
                >
                  {sendingId === p.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Mail size={14} />
                  )}
                  Voye kesyonman
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Repons */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Lis repons kliyan yo</h3>
          {responses.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center text-sm text-slate-400 font-medium">
              Poko gen repons.
            </div>
          ) : (
            responses.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelected(r);
                  setReply('');
                  setOkMsg('');
                }}
                className={`w-full text-left bg-white border rounded-2xl p-4 transition-all ${
                  selected?.id === r.id ? 'border-indigo-400 shadow-sm' : 'border-gray-200 hover:border-indigo-200'
                }`}
              >
                <div className="flex justify-between gap-2 mb-1">
                  <p className="font-bold text-sm text-slate-900 truncate">{r.full_name}</p>
                  <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mb-2">{r.email}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    {r.kyc_status_label || '—'}
                  </span>
                  {r.staff_replied_at ? (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                      Repons voye
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">
                      Annatant
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 min-h-[320px]">
          {!selected ? (
            <p className="text-sm text-slate-400 text-center py-16">Chwazi yon repons pou wè detay epi reponn.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-900">{selected.full_name}</h3>
                <p className="text-xs text-slate-500">{selected.email}</p>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {(selected.labeled_answers || []).map((a, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-[11px] font-bold text-slate-500 mb-1">{a.question}</p>
                    <p className="text-sm text-slate-800">{a.answer}</p>
                  </div>
                ))}
                {selected.free_text && (
                  <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                    <p className="text-[11px] font-bold text-indigo-600 mb-1">Kòmantè lib</p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{selected.free_text}</p>
                  </div>
                )}
              </div>

              {selected.staff_reply_preview && (
                <div className="text-xs text-slate-500 border-t border-gray-100 pt-3">
                  Dènye repons staff: {selected.staff_reply_preview}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Reponn pa email
                </label>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  placeholder="Ekri mesaj ou bay kliyan an..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  disabled={busy || !reply.trim()}
                  onClick={sendReply}
                  className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Voye email
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
