'use client';

import { useState } from 'react';
import { MessageSquareWarning, Loader2, X } from 'lucide-react';

type Props = {
  buyerTxId: string;
  amount?: number;
  alreadyRequested?: boolean;
  onDone?: () => void;
  compact?: boolean;
};

export function RequestRefundButton({
  buyerTxId,
  amount,
  alreadyRequested,
  onDone,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadyRequested || done) {
    return (
      <span className="inline-flex mt-2 text-[10px] font-bold uppercase tracking-wider text-amber-600">
        Demann ranbousman voye
      </span>
    );
  }

  const submit = async () => {
    setError(null);
    const r = reason.trim();
    if (r.length < 5) {
      setError('Ekri rezon ou (omwen 5 karaktè).');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/refunds/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer_tx_id: buyerTxId, reason: r }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) {
        setError(String(json.message || 'Demann echwe.'));
        return;
      }
      setDone(true);
      setOpen(false);
      onDone?.();
    } catch {
      setError('Koneksyon echwe.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 font-bold uppercase tracking-wider hover:bg-amber-100 transition-colors ${
          compact ? 'px-2.5 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px]'
        }`}
      >
        <MessageSquareWarning size={compact ? 11 : 12} />
        Mande ranbouse
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Mande ranbousman</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Di poukisa ou vle ranbousman
                  {amount != null ? ` (${Number(amount).toLocaleString()} HTG)` : ''}. Rezon an
                  obligatwa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              rows={4}
              maxLength={800}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Egzanp: sèvis la pa koresponn, mwen pa t resevwa, erè peman…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-y min-h-[100px]"
            />

            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl border border-gray-200"
              >
                Anile
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                Voye demann lan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
