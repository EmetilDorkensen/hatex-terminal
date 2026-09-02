'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

type Row = {
  id: string;
  merchant_amount: number | null;
  client_total: number | null;
  status: string;
  purpose: string;
  merchant_order_id: string | null;
  description: string | null;
  created_at: string;
  paid_at: string | null;
};

/** Peman kote machann nan RESEVWA kòb la (sèl sa yo ka verifye ak MonCash). */
const RECEIVE_PURPOSES = ['invoice', 'product', 'merchant'];

/** Yon peman ki sot kòmanse (mwens 90s) ka poko fin peye — pa re-check li otomatik. */
const AUTO_MIN_AGE_MS = 90_000;

function purposeLabel(purpose: string): string {
  if (purpose === 'invoice') return 'Fakti';
  if (purpose === 'product') return 'Pwodwi';
  if (purpose === 'merchant') return 'API';
  return purpose.toUpperCase();
}

type Notice = { tone: 'success' | 'warning' | 'info'; text: string };

/**
 * Tab tan reyèl — chif jodi a ak kantite peman sèlman.
 * Detay yo sou /transactions ak 5 dènye mesaj sou dashboard.
 *
 * Re-konsilyasyon: chak fwa paj la louvri (epi sou demann), nou mande sèvè a
 * pou l verifye peman 'an atant' yo dirèkteman sou MonCash. Sèvè a se sèl ki
 * ka make yon peman peye (DB), navigatè a pa ka fè anyen.
 */
export function LiveTransactionsPanel({ userId, gate }: { userId: string; gate: string | null }) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const autoRan = useRef(false);

  const loadRows = useCallback(async () => {
    const { data } = await supabase
      .from('hatex_payments')
      .select(
        'id, merchant_amount, client_total, status, purpose, merchant_order_id, description, created_at, paid_at'
      )
      .eq('merchant_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data as Row[]) || [];
  }, [supabase, userId]);

  const receivablePending = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.status === 'pending' &&
          (RECEIVE_PURPOSES as readonly string[]).includes(r.purpose)
      ),
    [rows]
  );

  /**
   * Re-konsilyasyon DB sèlman: sèvè a rele MonCash (Retrieve) pou chak peman
   * an atant epi li make 'paid' nan baz done si MonCash konfime. Lè l fini,
   * nou re-li DB a — verite a soti nan baz done a, pa nan navigatè a.
   */
  const runResync = useCallback(
    async (paymentId?: string) => {
      if (syncing) return;
      setSyncing(true);
      setSyncingId(paymentId || null);
      setNotice(null);
      try {
        const res = await fetch('/api/merchant/payments/resync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(paymentId ? { payment_id: paymentId } : {}),
        });
        const body = await res.json().catch(() => null);

        // DB = verite a — re-li tout peman yo apre re-konsilyasyon an.
        setRows(await loadRows());

        if (!res.ok || !body || body.ok !== true) {
          setNotice({
            tone: 'warning',
            text: (body && body.message) || 'Pa t kapab verifye peman an ak MonCash.',
          });
          return;
        }

        const { checked = 0, paid = 0, failed = 0 } = body.summary || {};
        if (paid > 0) {
          setNotice({
            tone: 'success',
            text:
              paid === 1
                ? '1 peman konfime sou MonCash — make peye nan baz done. '
                : `${paid} peman konfime sou MonCash — make peye nan baz done. `,
          });
        } else if (checked === 0) {
          setNotice({
            tone: 'info',
            text: paymentId
              ? 'Pa gen okenn peman an atant pou peman sa a.'
              : 'Pa gen okenn peman an atant pou verifye kounye a.',
          });
        } else if (failed > 0) {
          setNotice({
            tone: 'warning',
            text:
              failed === 1
                ? 'MonCash poko konfime peman an — li ka poko peye. '
                : `${failed} peman poko konfime sou MonCash — yo ka poko peye.`,
          });
        } else {
          setNotice({ tone: 'info', text: 'Tout peman an atant yo verifye ak MonCash.' });
        }
      } catch {
        setNotice({
          tone: 'warning',
          text: 'Erè rezo pandan verifyasyon an. Eseye ankò.',
        });
      } finally {
        setSyncing(false);
        setSyncingId(null);
      }
    },
    [syncing, loadRows]
  );

  // Realtime + premye chajman (done yo toujou soti nan baz done a).
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const next = await loadRows();
      if (!cancelled) {
        setRows(next);
        setLoading(false);
      }
    };
    void load();

    const channel = supabase
      .channel(`payments:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hatex_payments',
          filter: `merchant_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as Row | null;
          const oldRow = payload.old as Row | null;
          if (!next && !oldRow) return;

          setRows((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((r) => r.id !== (oldRow?.id || ''));
            }
            if (!next) return prev;
            const others = prev.filter((r) => r.id !== next.id);
            return [next, ...others].slice(0, 50);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setLive(true);
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, loadRows]);

  // Yon fwa lè paj la louvri: si gen peman an atant ki pa kòmanse jis kounye a,
  // verifye yo otomatikman sou MonCash (sèvè DB — pa janm konfyans navigatè).
  useEffect(() => {
    if (autoRan.current || loading) return;
    const eligible = receivablePending.filter(
      (r) => Date.now() - new Date(r.created_at).getTime() > AUTO_MIN_AGE_MS
    );
    if (eligible.length === 0) return;
    autoRan.current = true;
    void runResync();
  }, [receivablePending, loading, runResync]);

  const totalToday = useMemo(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return rows
      .filter((r) => r.status === 'paid' && new Date(r.paid_at || r.created_at) >= midnight)
      .reduce((sum, r) => sum + Number(r.merchant_amount || 0), 0);
  }, [rows]);

  const paid = rows.filter((r) => r.status === 'paid').length;
  const pending = rows.filter((r) => r.status === 'pending').length;


  return (
    <section className="mb-0 lg:mb-0">
      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        <header className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
              Tan reyèl · Tab kontwòl
            </p>
            <h2 className="text-lg font-bold text-slate-900">Vant &amp; peman machann</h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                live ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
              }`}
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {live ? 'Live' : 'Ap konekte'}
            </span>
          </div>
        </header>

        {notice && (
          <div
            className={`mx-5 mb-3 px-3 py-2 rounded-xl text-xs font-semibold flex items-start gap-2 ${
              notice.tone === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                : notice.tone === 'warning'
                  ? 'bg-amber-50 text-amber-800 border border-amber-100'
                  : 'bg-slate-50 text-slate-600 border border-gray-100'
            }`}
          >
            {notice.tone === 'success' ? (
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
            ) : notice.tone === 'warning' ? (
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            ) : null}
            <span>{notice.text}</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 px-5 pb-5">
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
              Jodi a
            </p>
            <p className="text-sm font-black text-slate-900 truncate">
              {Number(totalToday).toLocaleString('en-US')}{' '}
              <span className="text-[10px] font-semibold text-slate-500">HTG</span>
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">
              Peye
            </p>
            <p className="text-sm font-black text-slate-900">{paid}</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
              An atant
            </p>
            <p className="text-sm font-black text-slate-900">{pending}</p>
          </div>
        </div>


        {(receivablePending.length > 0 || syncing) && (
          <div className="border-t border-gray-100">
            <div className="flex items-center justify-between gap-2 px-5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {receivablePending.length > 0
                  ? `${receivablePending.length} peman an atant — verifye ak MonCash`
                  : 'Ap verifye peman an atant yo...'}
              </p>
              <button
                type="button"
                onClick={() => void runResync()}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {syncing && !syncingId ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                {syncing && !syncingId ? 'Ap verifye...' : 'Rekonsilye tout'}
              </button>
            </div>

            <ul className="divide-y divide-gray-50 px-5 pb-4">
              {receivablePending.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {r.description || r.merchant_order_id || purposeLabel(r.purpose)}
                      </span>
                      <span className="bg-indigo-50 text-indigo-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border border-indigo-100 shrink-0">
                        {purposeLabel(r.purpose)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {new Date(r.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · kliyan peye{' '}
                      {Number(r.client_total || 0).toLocaleString('fr-FR')} HTG · ou resevwa{' '}
                      {Number(r.merchant_amount || 0).toLocaleString('fr-FR')} HTG
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runResync(r.id)}
                    disabled={syncing}
                    title="Verifye peman sa a dirèkteman sou MonCash"
                    aria-label={`Verifye peman ${purposeLabel(r.purpose)} a sou MonCash`}
                    className="p-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    {syncingId === r.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="border-t border-gray-100 p-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <TrendingUp size={22} />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Pa gen tranzaksyon ankò</p>
            <p className="text-xs text-slate-500 mb-4">
              Lè yon kliyan peye, chif yo ap mete ajou isit la an dirèk.
            </p>
            <Link
              href={gate ?? '/dashboard/products/new'}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600"
            >
              Kreye yon pwodwi <ArrowUpRight size={14} />
            </Link>
          </div>
        )}

        {loading && (
          <div className="border-t border-gray-100 p-6 flex items-center justify-center text-slate-400">
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}

        {rows.length > 0 && (
          <Link
            href="/transactions"
            className="block text-center py-3 border-t border-gray-100 text-xs font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50/50"
          >
            Gade tout tranzaksyon
          </Link>
        )}
      </div>
    </section>
  );
}

