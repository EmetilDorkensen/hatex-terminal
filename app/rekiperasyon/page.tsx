"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Mail,
  Camera,
  FileUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';

/**
 * Rekiperasyon kont (tankou Stripe) — pou kliyan ki pèdi MFA + kòd aksè.
 * Soumèt: email kont lan + pyès idantite + foto live.
 * Asistans lan verifye epi voye yon lyen (1 èdtan) pa imèl.
 */
export default function AccountRecoveryPage() {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!idFront) {
      setError('Foto pyès idantite w (devan) obligatwa.');
      return;
    }
    if (!selfie) {
      setError('Foto live ou (selfie) obligatwa.');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('email', email.trim().toLowerCase());
      if (note.trim()) fd.set('note', note.trim());
      fd.set('id_front', idFront);
      if (idBack) fd.set('id_back', idBack);
      fd.set('selfie', selfie);

      const res = await fetch('/api/auth/account-recovery', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Pa t kapab voye demann lan. Eseye ankò.');
      }
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erè rezo. Eseye ankò.');
    } finally {
      setLoading(false);
    }
  };

  const fileLabel = (f: File | null, placeholder: string) =>
    f ? `${f.name.slice(0, 32)}${f.name.length > 32 ? '…' : ''}` : placeholder;

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white p-10 rounded-3xl border border-gray-200 shadow-xl text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-5" />
          <h1 className="text-xl font-bold text-slate-900 mb-3">Demann ou resevwa!</h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Ekip asistans lan ap verifye dokiman ou yo epi konpare yo ak dosye KYC ou.
            Si tout bagay bon, w ap resevwa yon <strong>imèl ak yon lyen</strong> pou w antre
            nan kont ou epi konfigire yon nouvo kòd MFA.
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-6">
            ⏱ Lyen an ap valab <strong>1 èdtan</strong> apre nou voye l — tcheke imèl ou souvan (ak spam).
          </p>
          <Link
            href="/login"
            className="inline-block bg-[#1d4ed8] text-white px-8 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-blue-800 transition-all"
          >
            Retounen sou koneksyon
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl border border-gray-200 shadow-xl">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#1d4ed8] mb-6"
        >
          <ArrowLeft size={14} /> Retounen
        </Link>

        <div className="text-center mb-8">
          <ShieldCheck className="w-10 h-10 text-[#1d4ed8] mx-auto mb-3" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mb-2">
            Rekipere kont ou
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Ou pèdi kòd MFA ou <strong>ak</strong> kòd aksè inik ou? Soumèt pyès idantite w +
            yon foto live. Ekip asistans lan ap verifye yo epi voye yon lyen rekiperasyon
            pa imèl (valab 1 èdtan).
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="rec-email" className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">
              Imèl kont HatexCard ou
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="rec-email"
                type="email"
                placeholder="kont@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-[#1d4ed8] outline-none transition-all text-sm font-medium text-slate-900"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1 block">
              Pyès idantite (devan) — obligatwa
            </span>
            <label className="flex items-center gap-3 bg-slate-50 border border-dashed border-gray-300 rounded-xl px-4 py-3.5 cursor-pointer hover:border-[#1d4ed8] transition-all">
              <FileUp className="w-5 h-5 text-slate-400 shrink-0" />
              <span className={`text-xs font-medium truncate ${idFront ? 'text-slate-900' : 'text-slate-400'}`}>
                {fileLabel(idFront, 'CIN, paspò oswa lisans (JPG/PNG/PDF, max 8MB)')}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                className="hidden"
                onChange={(e) => setIdFront(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1 block">
              Pyès idantite (dèyè) — si genyen
            </span>
            <label className="flex items-center gap-3 bg-slate-50 border border-dashed border-gray-300 rounded-xl px-4 py-3.5 cursor-pointer hover:border-[#1d4ed8] transition-all">
              <FileUp className="w-5 h-5 text-slate-400 shrink-0" />
              <span className={`text-xs font-medium truncate ${idBack ? 'text-slate-900' : 'text-slate-400'}`}>
                {fileLabel(idBack, 'Dèyè pyès la (opsyonèl)')}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                className="hidden"
                onChange={(e) => setIdBack(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1 block">
              Foto live ou (selfie) — obligatwa
            </span>
            <label className="flex items-center gap-3 bg-blue-50/50 border border-dashed border-blue-200 rounded-xl px-4 py-3.5 cursor-pointer hover:border-[#1d4ed8] transition-all">
              <Camera className="w-5 h-5 text-[#1d4ed8] shrink-0" />
              <span className={`text-xs font-medium truncate ${selfie ? 'text-slate-900' : 'text-slate-500'}`}>
                {fileLabel(selfie, 'Pran yon foto figi w kounye a (kamera)')}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                capture="user"
                className="hidden"
                onChange={(e) => setSelfie(e.target.files?.[0] || null)}
              />
            </label>
            <p className="text-[10px] text-slate-400 ml-1">
              Asistans lan ap konpare foto sa a ak pyès idantite w + dosye KYC ou.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rec-note" className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">
              Nòt (opsyonèl)
            </label>
            <textarea
              id="rec-note"
              rows={2}
              maxLength={1000}
              placeholder="Eksplike sa k pase a (ex: mwen chanje telefòn, app otantifikatè a efase)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-[#1d4ed8] outline-none transition-all text-sm text-slate-900 resize-none"
            />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-rose-700 text-[11px] font-bold leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1d4ed8] hover:bg-blue-800 py-4 rounded-xl font-bold uppercase tracking-wider text-xs text-white transition-all disabled:opacity-60 flex justify-center items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Ap voye dokiman yo...
              </>
            ) : (
              'Soumèt demann rekiperasyon'
            )}
          </button>
        </form>

        <p className="text-[10px] text-slate-400 text-center mt-6 leading-relaxed">
          Dokiman ou yo sere yon fason chifre e prive — se sèlman ekip asistans HatexCard
          ki ka wè yo, pou verifikasyon idantite w.
        </p>
      </div>
    </div>
  );
}
