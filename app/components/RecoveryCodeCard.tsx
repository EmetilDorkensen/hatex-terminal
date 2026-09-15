"use client";

import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, Copy, CheckCircle2, X, ShieldCheck, AlertTriangle } from 'lucide-react';

/**
 * Kòd Aksè Inik (rekiperasyon) — tankou Stripe.
 * - Jenere / afiche kòd la (step-up MFA obligatwa anvan)
 * - Kliyan an kopye l epi sere l pou konekte si li bliye MFA/modpas/PIN
 */
export default function RecoveryCodeCard() {
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [expired, setExpired] = useState(false);
  const [usedAt, setUsedAt] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // Modal MFA + rezilta
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'generate' | 'reveal'>('generate');
  const [mfaCode, setMfaCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revealedCode, setRevealedCode] = useState('');
  const [copied, setCopied] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/auth/recovery-code', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setExists(!!data.exists);
        setExpired(!!data.expired);
        setExpiresAt(data.expires_at || null);
        setUsedAt(data.used_at || null);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const openModal = (action: 'generate' | 'reveal') => {
    setPendingAction(action);
    setMfaCode('');
    setError('');
    setRevealedCode('');
    setCopied(false);
    setShowModal(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.replace(/\D/g, '').length !== 6) {
      setError('Antre kòd MFA 6 chif la.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/recovery-code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: pendingAction, mfa_code: mfaCode.replace(/\D/g, '') }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Erè. Eseye ankò.');
      }
      setRevealedCode(data.code);
      setExpiresAt(data.expires_at || null);
      setExists(true);
      setExpired(false);
      setUsedAt(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erè. Eseye ankò.');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(revealedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  };

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString('fr-HT', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="border-t border-gray-100 pt-6 mt-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-50 rounded-lg text-[#1d4ed8]"><KeyRound className="w-5 h-5" /></div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Kòd Aksè Inik (Rekiperasyon)</h4>
            <p className="text-[10px] text-slate-500 mt-0.5 max-w-md leading-relaxed">
              Kòd sekou pou konekte nan kont ou si w bliye kòd MFA, modpas oswa PIN ou.
              Li valab 2 zan epi li itilizab yon sèl fwa.
            </p>
          </div>
        </div>

        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        ) : exists && !expired ? (
          <button
            onClick={() => openModal('reveal')}
            className="bg-white border border-blue-200 text-[#1d4ed8] px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-50 transition-all"
          >
            Afiche kòd la
          </button>
        ) : (
          <button
            onClick={() => openModal('generate')}
            className="bg-[#1d4ed8] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-800 transition-all"
          >
            Jenere kòd aksè
          </button>
        )}
      </div>

      {!loading && exists && !expired && (
        <div className="mt-3 ml-14 flex items-center gap-3 flex-wrap">
          <span className="font-mono text-sm text-slate-400 tracking-wider">HTX-••••-••••-••••-••••</span>
          {expiryLabel && (
            <span className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md font-bold">
              Valab jiska {expiryLabel}
            </span>
          )}
          <button
            onClick={() => openModal('generate')}
            className="text-[10px] font-bold text-slate-500 underline hover:text-[#1d4ed8]"
          >
            Jenere yon nouvo
          </button>
        </div>
      )}

      {!loading && (expired || usedAt) && !revealedCode && (
        <p className="mt-3 ml-14 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 inline-flex items-center gap-2">
          <AlertTriangle size={13} />
          {usedAt ? 'Dènye kòd ou a itilize deja — jenere yon nouvo.' : 'Kòd ou a ekspire — jenere yon nouvo.'}
        </p>
      )}

      {/* ── MODAL MFA + AFICHAJ KÒD ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 w-full max-w-md rounded-3xl p-8 relative shadow-xl">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            {revealedCode ? (
              <div className="text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">Kòd Aksè Inik Ou</h3>
                <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                  <strong className="text-slate-700">Kopye l epi sere l yon kote ki an sekirite</strong> —
                  w ap sèvi avè l pou konekte nan kont ou si w bliye kòd MFA ou.
                  Nou p ap montre w li ankò san verifikasyon MFA.
                </p>

                <div className="bg-slate-900 text-emerald-400 font-mono text-lg tracking-wider rounded-2xl px-4 py-5 mb-4 select-all break-all">
                  {revealedCode}
                </div>

                <button
                  onClick={copyCode}
                  className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    copied
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-[#1d4ed8] text-white hover:bg-blue-800'
                  }`}
                >
                  {copied ? <><CheckCircle2 size={16} /> Kopye!</> : <><Copy size={16} /> Kopye kòd la</>}
                </button>

                {expiryLabel && (
                  <p className="text-[10px] text-slate-400 mt-4">Valab jiska {expiryLabel} · Itilizab yon sèl fwa</p>
                )}

                <button
                  onClick={() => setShowModal(false)}
                  className="w-full mt-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                >
                  Mwen sere l — fèmen
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="text-center">
                <ShieldCheck className="w-10 h-10 text-[#1d4ed8] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {pendingAction === 'generate' ? 'Jenere kòd aksè' : 'Afiche kòd aksè'}
                </h3>
                <p className="text-xs text-slate-500 mb-6">
                  Pou sekirite w, antre kòd MFA 6 chif ki nan app otantifikatè w la anvan nou
                  {pendingAction === 'generate' ? ' jenere' : ' afiche'} kòd aksè a.
                </p>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full max-w-[220px] mx-auto block px-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-[#1d4ed8] outline-none font-bold text-center text-xl tracking-[0.4em] text-slate-900"
                  required
                />

                {error && (
                  <p className="text-rose-600 text-[11px] font-bold mt-4 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy || mfaCode.length !== 6}
                  className="w-full mt-6 bg-[#1d4ed8] text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-blue-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? <><Loader2 size={16} className="animate-spin" /> Ap verifye...</> : 'Konfime'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
