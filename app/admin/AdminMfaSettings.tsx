"use client";

import React, { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ShieldCheck, Loader2, AlertTriangle, Smartphone, Trash2, CheckCircle2 } from 'lucide-react';

interface Props {
  supabase: SupabaseClient;
}

interface TotpFactor {
  id: string;
  friendly_name?: string;
  status: string;
  created_at: string;
}

export default function AdminMfaSettings({ supabase }: Props) {
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [pendingFactorId, setPendingFactorId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadFactors = async () => {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp as TotpFactor[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEnroll = async () => {
    setError('');
    setSuccess('');
    setEnrolling(true);
    const { data, error: enrollErr } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (enrollErr || !data) {
      setError(enrollErr?.message || 'Pa t kapab kòmanse enskripsyon MFA.');
      setEnrolling(false);
      return;
    }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setPendingFactorId(data.id);
  };

  const confirmEnroll = async () => {
    if (verifyCode.length !== 6) {
      setError('Kòd la dwe gen 6 chif.');
      return;
    }
    setError('');
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId });
      if (challengeErr || !challenge) throw new Error(challengeErr?.message || 'Erè chalenj MFA.');

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: pendingFactorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (verifyErr) throw new Error('Kòd la pa bon. Eseye ankò.');

      setSuccess('MFA aktive avèk siksè! Ou ap bezwen kòd sa a chak fwa ou konekte.');
      setEnrolling(false);
      setQrCode('');
      setSecret('');
      setVerifyCode('');
      setPendingFactorId('');
      loadFactors();
    } catch (err: any) {
      setError(err.message || 'Erè nan verifikasyon.');
    }
  };

  const removeFactor = async (factorId: string) => {
    if (!confirm('Retire aparèy MFA sa a? Ou p ap gen 2-etap ankò pou pwochen koneksyon w.')) return;
    setError('');
    const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId });
    if (unenrollErr) {
      setError(unenrollErr.message || 'Pa t kapab retire aparèy la.');
      return;
    }
    loadFactors();
  };

  const cancelEnroll = () => {
    setEnrolling(false);
    setQrCode('');
    setSecret('');
    setVerifyCode('');
    setPendingFactorId('');
    setError('');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-2">
        <span className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100"><ShieldCheck size={28} /></span>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sekirite Kont Admin (MFA)</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Otantifikasyon 2 Etap (TOTP)</p>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" size={24} /></div>
        ) : (
          <>
            {factors.length > 0 && (
              <div className="space-y-3 mb-6">
                {factors.map((f) => (
                  <div key={f.id} className="flex items-center justify-between bg-slate-50 border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <Smartphone size={18} className="text-indigo-600" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">Aparèy Otantifikatè</p>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 size={12} /> {f.status === 'verified' ? 'Aktif' : 'Ann atant verifikasyon'}
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
              <div className="text-center py-4">
                <AlertTriangle className="mx-auto text-amber-500 mb-3" size={28} />
                <p className="text-sm text-slate-600 mb-6">
                  Kont admin sa a PA gen MFA aktive. Nou rekòmande FÒTMAN ou aktive l pou pwoteje aksè admin la.
                </p>
                <button
                  onClick={startEnroll}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-wider transition-all shadow-sm"
                >
                  Aktive MFA Kounye a
                </button>
              </div>
            )}

            {!enrolling && factors.length > 0 && (
              <button
                onClick={startEnroll}
                className="mt-2 bg-white border border-gray-300 text-slate-700 px-5 py-2.5 rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-slate-50 transition-all"
              >
                Ajoute Yon Lòt Aparèy
              </button>
            )}

            {enrolling && qrCode && (
              <div className="text-center space-y-4 pt-2">
                <p className="text-sm font-bold text-slate-800">1. Eskane kòd QR sa a ak Google Authenticator/Authy</p>
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-2xl border border-gray-200" dangerouslySetInnerHTML={{ __html: qrCode }} />
                </div>
                <p className="text-[11px] text-slate-500">
                  Pa ka eskane l? Antre kòd sa a manyèlman: <span className="font-mono font-bold text-slate-700">{secret}</span>
                </p>

                <p className="text-sm font-bold text-slate-800 pt-2">2. Antre kòd 6 chif ki parèt nan app la</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full max-w-[200px] mx-auto block bg-slate-50 border border-gray-200 p-3 rounded-xl text-center text-xl font-mono tracking-[0.4em] outline-none focus:border-indigo-500"
                />

                <div className="flex gap-3 justify-center pt-2">
                  <button onClick={cancelEnroll} className="px-5 py-2.5 rounded-xl font-bold uppercase text-xs tracking-wider border border-gray-300 text-slate-600 hover:bg-slate-50">
                    Anile
                  </button>
                  <button
                    onClick={confirmEnroll}
                    disabled={verifyCode.length !== 6}
                    className="px-5 py-2.5 rounded-xl font-bold uppercase text-xs tracking-wider bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Konfime & Aktive
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl mt-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-rose-700 text-xs font-bold">{error}</p>
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl mt-6 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-emerald-700 text-xs font-bold">{success}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
