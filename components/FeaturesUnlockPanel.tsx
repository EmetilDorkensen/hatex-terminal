"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, Lock, Wallet } from 'lucide-react';
import { KYC_UNLOCK_FEE_HTG } from '@/lib/kyc/fees';

type UnlockInfo = {
  unlock_fee_htg: number;
  wallet_balance_htg: number;
  can_unlock: boolean;
  features_unlock_paid: boolean;
};

type Props = {
  /** Compact overlay style (kat page) vs banner (dashboard). */
  variant?: 'banner' | 'overlay';
  onUnlocked?: () => void;
};

/** CTA dezyèm 525 HTG — montan soti nan API/RPC, pa nan navigatè. */
export default function FeaturesUnlockPanel({ variant = 'banner', onUnlocked }: Props) {
  const router = useRouter();
  const [info, setInfo] = useState<UnlockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/kyc/unlock-features');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Pa ka chaje estati.');
        return;
      }
      setInfo({
        unlock_fee_htg: data.unlock_fee_htg ?? KYC_UNLOCK_FEE_HTG,
        wallet_balance_htg: data.wallet_balance_htg ?? 0,
        can_unlock: !!data.can_unlock,
        features_unlock_paid: !!data.features_unlock_paid,
      });
    } catch {
      setError('Erè koneksyon.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const payUnlock = async () => {
    setPaying(true);
    setError('');
    try {
      const res = await fetch('/api/kyc/unlock-features', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Peman echwe.');
        if (data.wallet_balance_htg != null) {
          setInfo((prev) =>
            prev
              ? { ...prev, wallet_balance_htg: data.wallet_balance_htg }
              : prev
          );
        }
        return;
      }
      setInfo((prev) =>
        prev
          ? {
              ...prev,
              features_unlock_paid: true,
              can_unlock: false,
              wallet_balance_htg: data.wallet_balance_htg ?? prev.wallet_balance_htg,
            }
          : prev
      );
      onUnlocked?.();
    } catch {
      setError('Erè koneksyon.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className={variant === 'overlay' ? 'flex flex-col items-center gap-2' : 'p-4'}>
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!info?.can_unlock && info?.features_unlock_paid) {
    return null;
  }

  const fee = info?.unlock_fee_htg ?? KYC_UNLOCK_FEE_HTG;
  const bal = info?.wallet_balance_htg ?? 0;
  const short = bal < fee;

  if (variant === 'overlay') {
    return (
      <div className="flex flex-col items-center justify-center text-center px-2">
        <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-3 border border-indigo-100">
          <Lock size={22} />
        </div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Kat bloke</h3>
        <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed">
          Peye <strong className="text-slate-800">{fee.toLocaleString()} HTG</strong> pou debloke kat, terminal ak fakti.
        </p>
        <p className="text-[10px] text-slate-400 mb-3 flex items-center gap-1">
          <Wallet size={12} /> {bal.toLocaleString()} HTG sou wallet
        </p>
        {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
        {short ? (
          <button
            type="button"
            onClick={() => router.push('/deposit')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider"
          >
            Fè Depo
          </button>
        ) : (
          <button
            type="button"
            disabled={paying}
            onClick={payUnlock}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
          >
            {paying ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
            Debloke {fee.toLocaleString()} HTG
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
          <Lock size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Debloke kat, terminal & fakti</h3>
          <p className="text-xs text-slate-600 mb-3 leading-relaxed">
            KYC ou apwouve. Peye <strong>{fee.toLocaleString()} HTG</strong> (dezyèm pati) pou kle a soti —
            montan an kalkile sou sèvè a.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mb-3">
            <span className="flex items-center gap-1"><Wallet size={12} /> Wallet: {bal.toLocaleString()} HTG</span>
          </div>
          {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {short ? (
              <button
                type="button"
                onClick={() => router.push('/deposit')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider"
              >
                Fè Depo
              </button>
            ) : (
              <button
                type="button"
                disabled={paying || !info?.can_unlock}
                onClick={payUnlock}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
              >
                {paying ? <Loader2 size={14} className="animate-spin" /> : null}
                Peye {fee.toLocaleString()} HTG
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
