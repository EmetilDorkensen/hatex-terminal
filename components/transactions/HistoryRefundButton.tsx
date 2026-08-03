'use client';

import { useState } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';

type Props = {
  /** ID tranzaksyon machann (kob antre) — sèvè a resolve sous la. */
  historyTxId?: string;
  /** Pou ranje fakti dirèk nan jounal Terminal (san tranzaksyon). */
  invoiceId?: string;
  amount?: number;
  alreadyRefunded?: boolean;
  /** Rezon default (egzanp rezon kliyan nan demann). */
  defaultReason?: string;
  onDone?: () => void;
  className?: string;
  compact?: boolean;
};

export function HistoryRefundButton({
  historyTxId,
  invoiceId,
  amount,
  alreadyRefunded,
  defaultReason,
  onDone,
  className = '',
  compact = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadyRefunded || done) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${className}`}
      >
        Ranbouse
      </span>
    );
  }

  if (!historyTxId && !invoiceId) return null;

  const handleRefund = async () => {
    setError(null);
    const reason =
      window.prompt(
        'Rezon ranbousman (opsyonèl):',
        defaultReason || 'Machann ranbouse kliyan'
      ) || '';
    const amtLabel =
      amount != null && Number.isFinite(amount) && amount > 0
        ? `${Number(amount).toLocaleString()} HTG`
        : 'kob la';
    if (
      !confirm(
        `Ranbouse ${amtLabel}? Kob la soti nan wallet ou epi tounen sou kat moun ki te peye a (san frè).`
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const body: Record<string, string> = {
        reason: reason || 'Ranbousman machann',
      };
      if (historyTxId) body.history_tx_id = historyTxId;
      else if (invoiceId) body.invoice_id = invoiceId;

      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) {
        setError(String(json.message || 'Ranbousman echwe.'));
        return;
      }
      setDone(true);
      onDone?.();
    } catch {
      setError('Koneksyon echwe. Eseye ankò.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`mt-2 ${className}`}>
      <button
        type="button"
        disabled={busy}
        onClick={handleRefund}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 font-bold uppercase tracking-wider hover:bg-rose-100 disabled:opacity-60 transition-colors ${
          compact ? 'px-2.5 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px]'
        }`}
      >
        {busy ? <Loader2 size={compact ? 11 : 12} className="animate-spin" /> : <RotateCcw size={compact ? 11 : 12} />}
        Ranbouse
      </button>
      {error && <p className="mt-1 text-[10px] text-rose-600 font-medium">{error}</p>}
    </div>
  );
}
