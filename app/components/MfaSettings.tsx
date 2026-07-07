"use client";

import React, { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ShieldCheck, Loader2, AlertTriangle, Smartphone, Trash2, CheckCircle2, Clock } from 'lucide-react';

interface Props {
  supabase: SupabaseClient;
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
}

interface TotpFactor {
  id: string;
  friendly_name?: string;
  status: string;
  created_at: string;
}

function formatServerTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('ht-HT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function MfaSettings({
  supabase,
  title = 'Otantifikasyon 2 Etap (MFA)',
  subtitle = 'Google Authenticator, Authy, elatriye',
  emptyMessage = 'Kont ou a pa gen MFA aktive. Aktive l pou plis sekirite lè w konekte.',
}: Props) {
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState('');
  const [secret, setSecret] = useState('');
  const [pendingFactorId, setPendingFactorId] = useState('');
  const [serverTime, setServerTime] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadFactors = async () => {
    setLoading(true);
    const res = await fetch('/api/auth/mfa/factors');
    const data = await res.json();
    setFactors((data.factors as TotpFactor[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const startEnroll = async () => {
    setError('');
    setSuccess('');
    setEnrolling(true);
    setQrCodeSvg('');
    setSecret('');
    setPendingFactorId('');
    setServerTime('');

    const res = await fetch('/api/auth/mfa/enroll', { method: 'POST' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      setError(data.message || 'Pa t kapab kòmanse enskripsyon MFA.');
      setEnrolling(false);
      return;
    }

    if (!data.qrCode || !data.factorId) {
      setError('Sistèm nan pa t ka jenere kòd QR la. Eseye ankò.');
      setEnrolling(false);
      return;
    }

    setQrCodeSvg(data.qrCode);
    setSecret(data.secret || '');
    setPendingFactorId(data.factorId);
    setServerTime(data.serverTime || '');
  };

  const confirmEnroll = async () => {
    const code = verifyCode.replace(/\D/g, '').trim();
    if (code.length !== 6) {
      setError('Kòd la dwe gen 6 chif.');
      return;
    }

    setError('');
    setVerifying(true);

    try {
      const res = await fetch('/api/auth/mfa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId: pendingFactorId, code, secret }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const timeHint = data.serverTime ? ` Lè sèvè a: ${formatServerTime(data.serverTime)}.` : '';
        throw new Error((data.message || 'Kòd la pa bon.') + timeHint);
      }

      await supabase.auth.refreshSession();

      setSuccess('MFA aktive avèk siksè! Ou ap bezwen kòd sa a chak fwa ou konekte.');
      setEnrolling(false);
      setQrCodeSvg('');
      setSecret('');
      setVerifyCode('');
      setPendingFactorId('');
      setServerTime('');
      await loadFactors();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erè nan verifikasyon.';
      setError(message);
    } finally {
      setVerifying(false);
    }
  };

  const removeFactor = async (factorId: string) => {
    if (!confirm('Retire aparèy MFA sa a? Ou p ap gen 2-etap ankò pou pwochen koneksyon w.')) return;
    setError('');

    const res = await fetch('/api/auth/mfa/factors', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factorId }),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      setError(data.message || 'Pa t kapab retire aparèy la.');
      return;
    }

    setSuccess('MFA retire avèk siksè.');
    loadFactors();
  };

  const cancelEnroll = async () => {
    if (pendingFactorId) {
      await fetch('/api/auth/mfa/factors', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId: pendingFactorId }),
      }).catch(() => {});
    }
    setEnrolling(false);
    setQrCodeSvg('');
    setSecret('');
    setVerifyCode('');
    setPendingFactorId('');
    setServerTime('');
    setError('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="p-3 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
          <ShieldCheck size={22} />
        </span>
        <div>
          <h4 className="text-sm font-bold text-slate-900">{title}</h4>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{subtitle}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-indigo-600" size={22} />
        </div>
      ) : (
        <>
          {factors.length > 0 && (
            <div className="space-y-2">
              {factors.map((f) => (
                <div key={f.id} className="flex items-center justify-between bg-slate-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <Smartphone size={18} className="text-indigo-600" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Aparèy Otantifikatè</p>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Aktif
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFactor(f.id)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    title="Retire"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!enrolling && factors.length === 0 && (
            <div className="text-center py-2">
              <AlertTriangle className="mx-auto text-amber-500 mb-2" size={24} />
              <p className="text-xs text-slate-600 mb-4">{emptyMessage}</p>
              <button
                onClick={startEnroll}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold uppercase text-xs tracking-wider transition-all"
              >
                Aktive MFA
              </button>
            </div>
          )}

          {!enrolling && factors.length > 0 && (
            <button
              onClick={startEnroll}
              className="bg-white border border-gray-300 text-slate-700 px-4 py-2 rounded-xl font-bold uppercase text-[10px] tracking-wider hover:bg-slate-50 transition-all"
            >
              Ajoute Yon Lòt Aparèy
            </button>
          )}

          {enrolling && qrCodeSvg && (
            <div className="text-center space-y-4 pt-2 border-t border-gray-100">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-left max-w-md mx-auto">
                <p className="text-[10px] text-blue-800 font-bold mb-1">⚠️ Enpòtan anvan ou eskane:</p>
                <p className="text-[10px] text-blue-700">
                  Efase tout ansyen antre &quot;HatexCard&quot; oswa &quot;Supabase&quot; ki deja nan app otantifikatè w la (Google Authenticator / Authy), epi eskane sèlman QR sa a.
                </p>
              </div>

              <p className="text-xs font-bold text-slate-800">1. Eskane kòd QR sa a</p>
              <div className="flex justify-center">
                <div
                  className="bg-white p-4 rounded-2xl border border-gray-200 inline-block [&>svg]:block"
                  dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Pa ka eskane l? Antre kòd sa a manyèlman (san espas):{' '}
                <span className="font-mono font-bold text-slate-700 break-all select-all">{secret}</span>
              </p>

              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-left max-w-sm mx-auto">
                <Clock size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[10px] text-amber-800 font-medium">
                  <p>Lè telefòn ou a dwe matche ak lè sèvè a.</p>
                  {serverTime && (
                    <p className="mt-1 font-bold">Lè sèvè HatexCard: {formatServerTime(serverTime)}</p>
                  )}
                  <p className="mt-1">Ale nan Paramèt → Dat ak Lè → aktive &quot;Lè otomatik&quot;.</p>
                </div>
              </div>

              <p className="text-xs font-bold text-slate-800 pt-1">2. Antre kòd 6 chif ki parèt nan app la</p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full max-w-[200px] mx-auto block bg-slate-50 border border-gray-200 p-3 rounded-xl text-center text-xl font-mono tracking-[0.4em] outline-none focus:border-indigo-500"
              />

              <div className="flex gap-3 justify-center pt-1">
                <button
                  onClick={cancelEnroll}
                  disabled={verifying}
                  className="px-4 py-2 rounded-xl font-bold uppercase text-[10px] tracking-wider border border-gray-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Anile
                </button>
                <button
                  onClick={confirmEnroll}
                  disabled={verifyCode.length !== 6 || verifying}
                  className="px-4 py-2 rounded-xl font-bold uppercase text-[10px] tracking-wider bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {verifying ? <Loader2 size={14} className="animate-spin" /> : null}
                  Konfime & Aktive
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-rose-700 text-[11px] font-bold">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-emerald-700 text-[11px] font-bold">{success}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
